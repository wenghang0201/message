import { showNotify as vantShowNotify } from 'vant'
import type { NotifyOptions } from 'vant'

const notifyColors = {
  primary: {
    background: '#1989fa',
    color: '#ffffff',
  },
  success: {
    background: '#07c160',
    color: '#ffffff',
  },
  danger: {
    background: '#ee0a24',
    color: '#ffffff',
  },
  warning: {
    background: '#ff976a',
    color: '#ffffff',
  },
}

export function showNotify(options: NotifyOptions | string) {
  if (typeof options === 'string') {
    return vantShowNotify(options)
  }

  const type = options.type || 'primary'
  const colors = notifyColors[type as keyof typeof notifyColors]

  return vantShowNotify({
    ...options,
    background: colors?.background,
    color: colors?.color,
  })
}
