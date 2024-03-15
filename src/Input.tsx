import { InputHTMLAttributes } from 'react'
import classNames from 'classnames'
import styles from './styles/Input.module.css'

export default function Input ({ className, children, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input className={classNames(styles.input, className)} {...rest}>
      {children}
    </input>
  )
}
