import { ButtonHTMLAttributes } from 'react'
import classNames from 'classnames'
import styles from './styles/Button.module.css'

export default function Button ({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={classNames(styles.button, className)} {...rest}>
      {children}
    </button>
  )
}
