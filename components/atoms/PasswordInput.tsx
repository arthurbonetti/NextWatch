import { AppInput, type AppInputProps } from './AppInput';

type PasswordInputProps = Omit<AppInputProps, 'secureTextEntry'>;

/**
 * Campo de senha padronizado (Login, Cadastro, Recuperação e Alterar Senha),
 * com controle de visibilidade sem truncamento e suporte nativo a helper text.
 */
export function PasswordInput({
  autoCapitalize = 'none',
  autoCorrect = false,
  spellCheck = false,
  ...props
}: PasswordInputProps) {
  return (
    <AppInput
      secureTextEntry
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      {...props}
    />
  );
}
