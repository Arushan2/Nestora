import { PasswordValidation, getPasswordStrengthLabel } from '../../lib/passwordValidation';

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidation;
}

export function PasswordStrengthIndicator({ validation }: PasswordStrengthIndicatorProps) {
  const strengthLabel = getPasswordStrengthLabel(validation);
  const checkedCount = [validation.length, validation.hasUppercase, validation.hasLowercase, validation.hasNumber, validation.hasSpecialChar].filter(Boolean).length;

  const getStrengthColor = () => {
    if (checkedCount === 0) return 'bg-gray-300';
    if (checkedCount === 1) return 'bg-red-500';
    if (checkedCount === 2) return 'bg-orange-500';
    if (checkedCount === 3) return 'bg-yellow-500';
    if (checkedCount === 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const getStrengthTextColor = () => {
    if (checkedCount === 0) return 'text-gray-600';
    if (checkedCount === 1) return 'text-red-600';
    if (checkedCount === 2) return 'text-orange-600';
    if (checkedCount === 3) return 'text-yellow-600';
    if (checkedCount === 4) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-3">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-600">Password Strength</span>
          <span className={`text-xs font-semibold ${getStrengthTextColor()}`}>{strengthLabel}</span>
        </div>
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${getStrengthColor()}`} style={{ width: `${(checkedCount / 5) * 100}%` }} />
        </div>
      </div>

      {/* Requirements checklist */}
      <div className="space-y-2 rounded-lg bg-ink-50 p-3">
        <p className="text-xs font-medium text-ink-700">Password must contain:</p>
        <ul className="space-y-1 text-xs">
          <li className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold ${validation.length ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {validation.length ? '✓' : '•'}
            </span>
            <span className={validation.length ? 'text-green-700 font-medium' : 'text-ink-600'}>At least 8 characters</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold ${validation.hasUppercase ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {validation.hasUppercase ? '✓' : '•'}
            </span>
            <span className={validation.hasUppercase ? 'text-green-700 font-medium' : 'text-ink-600'}>Uppercase letter (A-Z)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold ${validation.hasLowercase ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {validation.hasLowercase ? '✓' : '•'}
            </span>
            <span className={validation.hasLowercase ? 'text-green-700 font-medium' : 'text-ink-600'}>Lowercase letter (a-z)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold ${validation.hasNumber ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {validation.hasNumber ? '✓' : '•'}
            </span>
            <span className={validation.hasNumber ? 'text-green-700 font-medium' : 'text-ink-600'}>Number (0-9)</span>
          </li>
          <li className="flex items-center gap-2">
            <span className={`flex h-4 w-4 items-center justify-center rounded-full text-xs font-bold ${validation.hasSpecialChar ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'}`}>
              {validation.hasSpecialChar ? '✓' : '•'}
            </span>
            <span className={validation.hasSpecialChar ? 'text-green-700 font-medium' : 'text-ink-600'}>Special character (!@#$%^&* etc.)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
