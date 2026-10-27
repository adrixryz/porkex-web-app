// API messages that contain user data or a line number cannot be dictionary keys.
// Match only known complete messages, keeping names and CSV headers unchanged.
export function translateDynamicError(message: string): string | undefined {
  const type = (value: string) => (value === 'Income' ? 'ingreso' : 'gasto')
  let match = message.match(/^Invalid CSV quoting on line (\d+)\.$/)
  if (match) return `Las comillas del CSV no son válidas en la línea ${match[1]}.`
  match = message.match(/^Unclosed CSV quote on line (\d+)\.$/)
  if (match) return `Falta cerrar una comilla del CSV en la línea ${match[1]}.`
  match = message.match(/^The header must be (Date;Type;Account;Category;Tags;Comment;Amount)\.$/)
  if (match) return `El encabezado debe ser ${match[1]}.`
  match = message.match(/^Category "(.*)" already belongs to (Income|Expense)\.$/)
  if (match) return `La categoría "${match[1]}" ya pertenece a ${type(match[2]!)}.`
  match = message.match(
    /^Category "(.*)" is (Income|Expense), but (transaction|the rule) is (Income|Expense)\.$/
  )
  if (match)
    return `La categoría "${match[1]}" es de ${type(match[2]!)}, pero ${match[3] === 'the rule' ? 'la regla' : 'la transacción'} es de ${type(match[4]!)}.`
  match = message.match(
    /^Target category "(.*)" is (Income|Expense), but "(.*)" is (Income|Expense)\.$/
  )
  if (match)
    return `La categoría de destino "${match[1]}" es de ${type(match[2]!)}, pero "${match[3]}" es de ${type(match[4]!)}.`
  match = message.match(
    /^(New password|Password) must be (at least|at most) (\d+) (characters|bytes)\.$/
  )
  if (match) {
    const label = match[1] === 'Password' ? 'La contraseña' : 'La nueva contraseña'
    const minimum = match[2] === 'at least' ? 'al menos' : 'como máximo'
    const unit = match[4] === 'characters' ? 'caracteres' : 'bytes'
    return `${label} debe tener ${minimum} ${match[3]} ${unit}.`
  }
  match = message.match(/^(New password|Password) is required\.$/)
  if (match)
    return match[1] === 'Password'
      ? 'Se requiere la contraseña.'
      : 'Se requiere la nueva contraseña.'
  match = message.match(/^(Account|Category|Tag|Favorite) names in the backup must be unique\.$/)
  if (match) {
    const names: Record<string, string> = {
      Account: 'cuentas',
      Category: 'categorías',
      Tag: 'etiquetas',
      Favorite: 'favoritos'
    }
    return `Los nombres de ${names[match[1]!]} en la copia de seguridad deben ser únicos.`
  }
  match = message.match(/^(Name|Description) must be at most (\d+) characters\.$/)
  if (match)
    return `${match[1] === 'Name' ? 'El nombre' : 'El comentario'} debe tener como máximo ${match[2]} caracteres.`
  match = message.match(/^Interval must be a whole number between 1 and (\d+)\.$/)
  if (match) return `El intervalo debe ser un número entero entre 1 y ${match[1]}.`
  match = message.match(
    /^(Account|Category|Goal|Favorite|Tag) name must contain 1–(\d+) characters\. Use letters, numbers, spaces and hyphens only\.$/
  )
  if (match) {
    const names: Record<string, string> = {
      Account: 'de la cuenta',
      Category: 'de la categoría',
      Goal: 'de la meta',
      Favorite: 'del favorito',
      Tag: 'de la etiqueta'
    }
    return `El nombre ${names[match[1]!]} debe tener entre 1 y ${match[2]} caracteres. Usa solo letras, números, espacios y guiones.`
  }
}
