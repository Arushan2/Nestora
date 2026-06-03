/**
 * Password validation utilities for strong password enforcement
 */

export interface PasswordValidation {
  isValid: boolean;
  length: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  return {
    isValid: validatePasswordStrict(password),
    length: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

export function validatePasswordStrict(password: string): boolean {
  const validation = {
    length: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  return Object.values(validation).every((v) => v);
}

export function getPasswordStrengthLabel(validation: PasswordValidation): string {
  const checkedCount = [validation.length, validation.hasUppercase, validation.hasLowercase, validation.hasNumber, validation.hasSpecialChar].filter(Boolean).length;

  if (checkedCount === 0) return 'Very Weak';
  if (checkedCount === 1) return 'Weak';
  if (checkedCount === 2) return 'Fair';
  if (checkedCount === 3) return 'Good';
  if (checkedCount === 4) return 'Strong';
  return 'Very Strong';
}
