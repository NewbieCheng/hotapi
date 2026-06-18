import type { InputHTMLAttributes } from 'react'
import './TextField.css'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string
  hint?: string
  error?: string
  mono?: boolean
  className?: string
}

export function TextField({
  label,
  hint,
  error,
  mono = false,
  className = '',
  id,
  ...rest
}: TextFieldProps) {
  const fieldId = id || (label ? `field-${label}` : undefined)
  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={fieldId}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      <input
        id={fieldId}
        className={`ui-field__input ${mono ? 'ui-field__input--mono' : ''} ${error ? 'ui-field__input--error' : ''}`.trim()}
        {...rest}
      />
      {error ? <span className="ui-field__error">{error}</span> : null}
      {!error && hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  )
}

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> {
  label?: string
  hint?: string
  error?: string
  className?: string
}

export function TextArea({ label, hint, error, className = '', id, ...rest }: TextAreaProps) {
  const fieldId = id || (label ? `field-${label}` : undefined)
  return (
    <label className={`ui-field ${className}`.trim()} htmlFor={fieldId}>
      {label ? <span className="ui-field__label">{label}</span> : null}
      <textarea
        id={fieldId}
        className={`ui-field__input ui-field__textarea ${error ? 'ui-field__input--error' : ''}`.trim()}
        {...rest}
      />
      {error ? <span className="ui-field__error">{error}</span> : null}
      {!error && hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  )
}
