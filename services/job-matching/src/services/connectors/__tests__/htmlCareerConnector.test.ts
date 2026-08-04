import { parseHtmlList, type CareerSite } from '../htmlCareerConnector';

const TBANK: CareerSite = {
  id: 'tbank',
  name: 'Т-Банк',
  kind: 'html_list',
  list_url: 'https://www.tbank.ru/career/vacancies/it/',
  link_contains: ['/vacancy/'],
  path_regex: '/career/[^/]+/vacancy/[^/]+/[^/]+/[0-9a-f-]{8,}',
  path_exclude: ['operator-rannego', 'predstavitel', 'operator_rannego'],
};

describe('htmlCareerConnector tbank (Kabi parity)', () => {
  it('keeps IT product vacancy and drops excluded service roles', () => {
    const html = `
    <a href="/career/it/vacancy/moscow/timlid-produktovoj-analitiki-ekvajring/b8edbeb0-f104-4d16-ba68-87072deb62a9/">x</a>
    <a href="/career/service/vacancy/moscow/predstavitel/bc297685-1966-46ec-820a-b47f2a48492b/">y</a>
    <a href="/career/service/vacancy/moscow/operator-rannego-vzyskaniya/1aff2ffe-dd53-4b21-8cd9-1d63c8633f1a/">z</a>
    `;
    const jobs = parseHtmlList(html, TBANK, ['produkt', 'product', 'lead', 'timlid'], 20);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].source).toBe('career_tbank');
    expect(jobs[0].source_url).toContain('b8edbeb0-f104-4d16-ba68-87072deb62a9');
    expect(jobs[0].title.toLowerCase()).toMatch(/produkt|timlid/);
  });

  it('picks vacancy paths from raw SSR text without anchor', () => {
    const html =
      '"url":"/career/it/vacancy/moscow/product-owner-payments/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/"';
    const jobs = parseHtmlList(html, TBANK, ['product', 'owner'], 10);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
    expect(jobs[0].title.toLowerCase()).toContain('product');
  });
});
