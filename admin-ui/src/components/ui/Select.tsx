import type { ReactNode, SelectHTMLAttributes } from 'react'
import './Select.css'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> {
  label?: string
  options: SelectOption[]
  className?: string
  children?: ReactNode
}

export function Select({ label, options, className = '', id, children, ...rest }: SelectProps) {
  const fieldId = id || (label ? `select-${label}` : undefined)
  return (
    <label className={`ui-select-wrap ${className}`.trim()} htmlFor={fieldId}>
      {label ? <span className="ui-select-wrap__label">{label}</span> : null}
      <select id={fieldId} className="ui-select" {...rest}>
        {children}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
