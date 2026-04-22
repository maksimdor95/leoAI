import axios, { AxiosError, isAxiosError } from 'axios';
import { logger } from '../utils/logger';
import { getHHAccessToken, getHHUserAgent } from './hhAuthService';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const HH_USER_AGENT = getHHUserAgent();

/** Страница оформления доступа к банку зарплат (OpenAPI: платные отчёты). */
export const HH_SALARY_BANK_PROMO_URL = 'https://salary.hh.ru/promo';
export const HH_OPENAPI_REDOC = 'https://api.hh.ru/openapi/redoc';

type PrimitiveQueryValue = string | number | boolean;
type SalaryQuery = Record<string, PrimitiveQueryValue>;

export class HHSalaryApiError extends Error {
  readonly statusCode: number;
  readonly body: Record<string, unknown>;

  constructor(statusCode: number, body: Record<string, unknown>, message?: string) {
    super(message || `HH salary API error (${statusCode})`);
    this.name = 'HHSalaryApiError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

function pickFirstErrorValue(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const errors = (data as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (!first || typeof first !== 'object') return undefined;
  const value = (first as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}

function pickFirstErrorType(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const errors = (data as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const first = errors[0];
  if (!first || typeof first !== 'object') return undefined;
  const t = (first as { type?: unknown }).type;
  return typeof t === 'string' ? t : undefined;
}

function pickOauthError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const oauth = (data as { oauth_error?: unknown }).oauth_error;
  return typeof oauth === 'string' ? oauth : undefined;
}

function pickRequestId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const rid = (data as { request_id?: unknown }).request_id;
  return typeof rid === 'string' ? rid : undefined;
}

function pickDescription(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const desc = (data as { description?: unknown }).description;
  return typeof desc === 'string' ? desc : undefined;
}

function buildFriendlyMessage(params: {
  statusCode: number;
  oauthError?: string;
  errorType?: string;
  errorValue?: string;
  errorDescription?: string;
  serverDescription?: string;
}): { code: string; message: string } {
  const { statusCode, oauthError, errorType, errorValue, errorDescription, serverDescription } =
    params;

  if (statusCode === 404) {
    return {
      code: 'HH_SALARY_NO_DATA',
      message: 'Для указанных параметров нет данных в банке зарплат HH.',
    };
  }

  if (statusCode === 400) {
    if (errorDescription === 'account not found' || serverDescription === 'account not found') {
      return {
        code: 'HH_OAUTH_INVALID_CLIENT',
        message: 'Неверная пара client_id/client_secret при обмене токена HH.',
      };
    }
    return {
      code: 'HH_SALARY_BAD_REQUEST',
      message: 'Некорректные параметры запроса к HH salary API.',
    };
  }

  if (statusCode === 401) {
    if (oauthError === 'token-revoked' || errorValue === 'token_revoked') {
      return {
        code: 'HH_OAUTH_TOKEN_REVOKED',
        message: 'HH токен отозван. Нужна повторная авторизация OAuth.',
      };
    }
    if (oauthError === 'token-expired' || errorValue === 'token_expired') {
      return {
        code: 'HH_OAUTH_TOKEN_EXPIRED',
        message: 'HH access_token истёк. Обновите токен через refresh_token или повторную авторизацию.',
      };
    }
    return {
      code: 'HH_OAUTH_UNAUTHORIZED',
      message: 'HH отклонил авторизацию (401): неверный или неподходящий Bearer токен.',
    };
  }

  if (statusCode === 403) {
    if (oauthError === 'token-revoked' || errorValue === 'token_revoked') {
      return {
        code: 'HH_OAUTH_TOKEN_REVOKED',
        message: 'HH токен отозван. Нужна повторная авторизация OAuth.',
      };
    }
    if (oauthError === 'token-expired' || errorValue === 'token_expired') {
      return {
        code: 'HH_OAUTH_TOKEN_EXPIRED',
        message: 'HH access_token истёк. Обновите токен через refresh_token или повторную авторизацию.',
      };
    }
    if (oauthError === 'bad-auth-type' || errorValue === 'bad_authorization') {
      return {
        code: 'HH_OAUTH_BAD_AUTH',
        message: 'HH отклонил авторизацию (некорректный/неподходящий токен).',
      };
    }
    if (oauthError === 'client-id-deleted' || errorValue === 'application_not_found') {
      return {
        code: 'HH_OAUTH_APP_DELETED',
        message: 'Приложение HH удалено или client_id недействителен.',
      };
    }
    if (errorValue === 'user_auth_expected') {
      return {
        code: 'HH_OAUTH_USER_AUTH_EXPECTED',
        message: 'Метод требует пользовательский OAuth токен HH, а передан токен приложения.',
      };
    }
    if (errorValue === 'application_auth_expected') {
      return {
        code: 'HH_OAUTH_APP_AUTH_EXPECTED',
        message: 'Метод требует токен приложения HH, а передан пользовательский токен.',
      };
    }
    if (errorValue === 'no_scope') {
      return {
        code: 'HH_OAUTH_NO_SCOPE',
        message: 'В HH токене нет нужного scope для salary bank.',
      };
    }

    if (errorType === 'forbidden') {
      return {
        code: 'HH_SALARY_FORBIDDEN',
        message:
          'HH вернул «forbidden»: нет прав на этот платный отчёт банка зарплат (подписка/роль/доступ к Salary Bank).',
      };
    }

    // Частый кейс для salary bank: токен валиден, но нет доступа к платным отчётам.
    return {
      code: 'HH_SALARY_FORBIDDEN',
      message:
        'Нет доступа к платным отчётам банка зарплат HH для этого аккаунта/токена (или недостаточно прав).',
    };
  }

  return {
    code: 'HH_SALARY_UPSTREAM_ERROR',
    message: `HH salary API вернул HTTP ${statusCode}.`,
  };
}

export async function getSalaryEvaluation(
  areaId: number,
  query: SalaryQuery = {}
): Promise<unknown> {
  if (!Number.isInteger(areaId) || areaId <= 0) {
    throw new Error('areaId must be a positive integer');
  }

  const token = await getHHAccessToken();
  if (!token) {
    throw new Error('Failed to obtain HH access token for salary API');
  }
  const url = `${HH_API_URL}/salary_statistics/paid/salary_evaluation/${areaId}`;

  logger.info(`[hh-salary] Request salary evaluation for areaId=${areaId}`);
  try {
    const response = await axios.get(url, {
      params: query,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': HH_USER_AGENT,
        'HH-User-Agent': HH_USER_AGENT,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      const ax = error as AxiosError<unknown>;
      const status = ax.response?.status;
      const data = ax.response?.data;

      if (typeof status === 'number' && data !== undefined) {
        const oauthError = pickOauthError(data);
        const errorType = pickFirstErrorType(data);
        const errorValue = pickFirstErrorValue(data);
        const requestId = pickRequestId(data);
        const description = pickDescription(data);

        // HH иногда отдаёт error/error_description в OAuth-стиле (400 на /token),
        // но для salary evaluation чаще JSON с errors/request_id.
        const oauthStyleError =
          data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
            ? String((data as { error?: unknown }).error)
            : undefined;
        const oauthStyleDesc =
          data && typeof data === 'object' && typeof (data as { error_description?: unknown }).error_description === 'string'
            ? String((data as { error_description?: unknown }).error_description)
            : undefined;

        const friendly = buildFriendlyMessage({
          statusCode: status,
          oauthError,
          errorType,
          errorValue,
          errorDescription: oauthStyleDesc,
          serverDescription: description,
        });

        logger.warn(
          `[hh-salary] HH error status=${status} request_id=${requestId ?? 'n/a'} oauth_error=${oauthError ?? 'n/a'} error_type=${errorType ?? 'n/a'} error_value=${errorValue ?? 'n/a'} oauth_style=${oauthStyleError ?? 'n/a'} desc=${description ?? 'n/a'}`
        );

        const body: Record<string, unknown> = {
          source: 'hh.ru',
          endpoint: '/salary_statistics/paid/salary_evaluation/:areaId',
          areaId,
          hh: {
            status,
            request_id: requestId,
            oauth_error: oauthError,
            error_type: errorType,
            error_value: errorValue,
            description,
            oauth_style_error: oauthStyleError,
            oauth_style_error_description: oauthStyleDesc,
          },
          client: {
            code: friendly.code,
            message: friendly.message,
          },
        };

        if (friendly.code === 'HH_SALARY_FORBIDDEN') {
          body.hints = {
            salary_bank_promo_url: HH_SALARY_BANK_PROMO_URL,
            salary_contacts_note:
              'Вопросы по подключению банка зарплат: см. контакты на salary.hh.ru (в т.ч. zarplaty@hh.ru).',
          };
        }

        if (friendly.code === 'HH_SALARY_NO_DATA') {
          body.hints = {
            openapi_redoc: HH_OPENAPI_REDOC,
            try_extend_sources:
              'По документации HH: при нехватке данных в банке зарплат можно передать extend_sources=true (подмешивание вакансий/резюме, менее надёжная выборка).',
          };
        }

        throw new HHSalaryApiError(status, body);
      }
    }

    throw error;
  }
}
