## Безопасный пользовательский вход

Описываем минимальный набор улучшений, которые повысят надёжность регистрации/входа и помогут завершить работу на основе референса из скриншота.

### Основные требования

- **Сброс пароля:** ссылка «Забыли пароль?» отправляет письмо/смс, ввод кода или переход по ссылке ведёт на форму установки нового пароля. Это убирает страх потерять доступ.
- **Вход по телефону и OTP:** рядом с логином по email предлагается «Войти по телефону». Пользователь вводит номер, нажимает «Отправить код», получает OTP, вводит его и попадает внутрь. Повторяет паттерн с мобильной верификацией.
- **Подтверждение email/телефона:** в процессе регистрации отправляем confirmation link на почту и SMS-код на телефон. Статус отображается в UI (например, «Почта подтверждена ✓»).
- **Проверка дубликатов:** при регистрации/обновлении отображаем ошибку, если email или телефон уже заняты. Пароли проверяются на сложность и (опционально) на совпадение с недавними паролями, но не сравниваются друг с другом обычным способом.
- **UX-структура:** модалка с табами «Sign up / Sign in», затем поле для имени/фамилии, email, телефон, пароль и кнопка первичного действия. Под ней располагаются кнопки социальных входов, а под ними вспомогательные ссылки и инфо-статусы.

### Компонент `AuthModal`

#### Пропсы

- `mode`: `'sign-up' | 'sign-in'`
- `onClose`
- `onSubmit`
- `onOtpRequest`

#### Состояние

- `formValues`: `{ firstName?, lastName?, email?, phone?, password?, otp? }`
- `activeInputMode`: `'email' | 'phone'`
- `otpRequested`: boolean
- `verificationStatus`: `{ email: 'pending' | 'sent' | 'verified'; phone: ... }`
- `errors`: `{ email?: string; phone?: string; password?: string }`

#### Подкомпоненты

- **`TabList`** — переключатели для Sign up / Sign in и Email / Phone.
- **`InputField`** — единая обёртка с меткой, подсказкой, иконкой и валидацией.
- **`PhoneInput` / `OtpField`** — поле номера, кнопка отправки OTP и второе поле ввода кода; кнопка становится активной только после валидации номера.
- **`StatusList`** — отображает состояние подтверждения email/телефона и отправки OTP.
- **`SocialButtons`** — кнопки входа/регистрации через Google, Apple.
- **`FooterLinks`** — «Забыли пароль?», «Условия», «Поддержка», текст про проверку дубликатов.

### Пример макета

```jsx
<Dialog>
  <Header>
    <Tab selected={mode === 'sign-up'}>Sign up</Tab>
    <Tab selected={mode === 'sign-in'}>Sign in</Tab>
    <CloseIcon />
  </Header>

  <Content>
    <Row>
      <InputField label="First name" name="firstName" />
      <InputField label="Last name" name="lastName" />
    </Row>
    <InputField label="Email" name="email" type="email" />
    <PhoneInput label="Phone" name="phone" onOtpRequest={handleOtpRequest} />
    <InputField label="Password" name="password" type="password" />
    <StatusRow>
      <StatusItem verified={emailConfirmed}>Email подтверждён</StatusItem>
      <StatusItem verified={phoneConfirmed}>Телефон подтверждён</StatusItem>
    </StatusRow>
    <PrimaryButton>{mode === 'sign-up' ? 'Create an account' : 'Sign in'}</PrimaryButton>
    <Divider>OR SIGN IN WITH</Divider>
    <SocialButtons providers={['google', 'apple']} />
    <Footer>
      <Link>Забыли пароль?</Link>
      <Text>Мы проверяем email и телефон на дубли.</Text>
    </Footer>
  </Content>
</Dialog>
```

Карточка должна быть выровнена по центру, иметь тёмный градиент, мягкую тень и закруглённые углы в стиле оригинальной модалки. Поля с подсказками и анимацией фокуса помогают пользователю ориентироваться.

### Рекомендации по шагам

1. Реализовать модальные табы и форму с полями email/phone + OTP.
2. Добавить обработку «Забыли пароль» и отправку подтверждений.
3. Настроить индикацию статуса (верификация, отправка кода).
4. Подключить повторную проверку дубликатов на уровне API/формы.
5. Добавить соцвходы и подсказки безопасности в футер.


