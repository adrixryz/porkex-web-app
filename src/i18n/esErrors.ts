const errors: Record<string, string> = {
  'Expected seven columns.': 'Se requieren siete columnas.',
  'Date must be YYYY-MM-DD, on or before today.':
    'La fecha debe usar AAAA-MM-DD y no ser posterior a hoy.',
  'Type must be Income or Expense.': 'El tipo debe ser Income o Expense.',
  'Account must contain 1–60 letters, numbers, spaces or hyphens.':
    'La cuenta debe tener entre 1 y 60 letras, números, espacios o guiones.',
  'Category must contain 1–60 letters, numbers, spaces or hyphens.':
    'La categoría debe tener entre 1 y 60 letras, números, espacios o guiones.',
  'Use at most five unique tags of 1–20 letters, numbers, spaces or hyphens.':
    'Usa hasta cinco etiquetas distintas de 1 a 20 letras, números, espacios o guiones.',
  'Comment must contain at most 200 characters.':
    'El comentario debe tener como máximo 200 caracteres.',
  'Amount must be positive, at most 10,000,000, with up to two decimal places and a decimal point.':
    'El importe debe ser positivo, no superar 10,000,000 y tener como máximo dos decimales con punto decimal.',
  'More than one account has this name. Rename the accounts before importing.':
    'Más de una cuenta tiene este nombre. Renombra las cuentas antes de importar.',
  'Choose a regular account, not a savings goal.':
    'Elige una cuenta normal, no una meta de ahorro.',
  'The same new category cannot belong to both Income and Expense.':
    'Una misma categoría nueva no puede pertenecer a ingresos y gastos a la vez.',
  'Restore the archived account before importing new transactions into it.':
    'Restaura la cuenta archivada antes de importar nuevas transacciones en ella.',
  'The backup contains duplicate records. No data was changed.':
    'La copia de seguridad contiene registros duplicados. No se modificaron datos.',
  'The backup contains duplicate catalogue entries. No data was changed.':
    'La copia de seguridad contiene entradas de catálogo duplicadas. No se modificaron datos.',
  'The backup contains broken references. No data was changed.':
    'La copia de seguridad contiene referencias inválidas. No se modificaron datos.',
  'Tag names in the backup do not match their canonical keys.':
    'Los nombres de las etiquetas en la copia de seguridad no coinciden con sus claves.',
  '"from" must be earlier than or equal to "to".':
    'La fecha inicial debe ser igual o anterior a la fecha final.',
  '"max" must be greater than or equal to "min".':
    'El máximo debe ser mayor o igual que el mínimo.',
  'A category with that name already exists.': 'Ya existe una categoría con ese nombre.',
  'A favorite with that name already exists.': 'Ya existe un favorito con ese nombre.',
  'A rule, scheduled date and SKIP or EDIT action are required.':
    'Se requieren una regla, una fecha programada y una acción válida.',
  'A stable mutation ID is required.': 'Se requiere un identificador estable para el cambio.',
  'A stable operation ID is required.': 'Se requiere un identificador estable para la operación.',
  'A tag no longer exists. Refresh the catalog.':
    'Una etiqueta ya no existe. Actualiza el catálogo.',
  'A tag with that name already exists.': 'Ya existe una etiqueta con ese nombre.',
  'A unique list of tag ids is required.': 'Se requiere una lista de etiquetas sin duplicados.',
  'A valid adjustment and stable operation ID are required.':
    'Se requieren un ajuste válido y un identificador estable para la operación.',
  'A valid start date is required.': 'Se requiere una fecha de inicio válida.',
  'Access denied. No token provided.': 'Acceso denegado. No se proporcionó una sesión válida.',
  'Account not found.': 'No se encontró la cuenta.',
  'Amount must be a positive number within the allowed range.':
    'El importe debe ser positivo y estar dentro del rango permitido.',
  'An account with that name already exists.': 'Ya existe una cuenta con ese nombre.',
  'Archive the account with a zero balance before deleting it.':
    'Archiva la cuenta con saldo cero antes de eliminarla.',
  'Balance adjustment not found.': 'No se encontró el ajuste de saldo.',
  'Budget creation failed.': 'No se pudo crear el presupuesto.',
  'Budget not found.': 'No se encontró el presupuesto.',
  'Budget update failed.': 'No se pudo actualizar el presupuesto.',
  'Cannot change type: category has existing transactions.':
    'No se puede cambiar el tipo porque la categoría tiene transacciones.',
  'Cannot delete category with existing transactions.':
    'No se puede eliminar una categoría con transacciones existentes.',
  'Cannot reassign transactions to the same category.':
    'No se pueden reasignar transacciones a la misma categoría.',
  'Category creation failed.': 'No se pudo crear la categoría.',
  'Category is used by a next-only edit. Edit or skip that occurrence first.':
    'La categoría se usa en una edición de la siguiente ocurrencia. Primero edita u omite esa ocurrencia.',
  'Category not found.': 'No se encontró la categoría.',
  'Category update failed.': 'No se pudo actualizar la categoría.',
  'Choose Expense or Income.': 'Elige Gasto o Ingreso.',
  'Choose a UTF-8 CSV file.': 'Elige un archivo CSV UTF-8.',
  'Choose a valid category.': 'Elige una categoría válida.',
  'Choose a valid total balance setting.': 'Elige una opción válida para el saldo total.',
  'Choose an active account.': 'Elige una cuenta activa.',
  'Choose an expense category for a spending budget.':
    'Elige una categoría de gastos para el presupuesto.',
  'Choose two active accounts.': 'Elige dos cuentas activas.',
  'Choose up to five available tags.': 'Elige hasta cinco etiquetas disponibles.',
  'Color must be a hex value like #RRGGBB.': 'El color debe ser un valor hexadecimal como #RRGGBB.',
  'Comment must be a string of at most 200 characters.':
    'El comentario debe ser un texto de hasta 200 caracteres.',
  'Correct all CSV errors before importing.':
    'Corrige todos los errores del CSV antes de importar.',
  'Could not confirm session revocation. Sign in again if necessary.':
    'No se pudo confirmar el cierre de sesiones. Vuelve a iniciar sesión si es necesario.',
  'Could not load favorites.': 'No se pudieron cargar los favoritos.',
  'Could not save category order.': 'No se pudo guardar el orden de las categorías.',
  'Could not verify the session. Please retry.':
    'No se pudo verificar la sesión. Inténtalo de nuevo.',
  'Current and new password are required.': 'Se requieren la contraseña actual y la nueva.',
  'Current password is incorrect.': 'La contraseña actual es incorrecta.',
  'Date cannot be in the future.': 'La fecha no puede ser futura.',
  'Decimal separator must be "." or ",".': 'El separador decimal debe ser «.» o «,».',
  'Default period must be day, week, month or year.':
    'El período predeterminado debe ser día, semana, mes o año.',
  'Delete failed.': 'No se pudo eliminar.',
  'Email already registered.': 'Este correo ya está registrado.',
  'Email and password are required.': 'Se requieren el correo y la contraseña.',
  'Enable automatic date and time before retrying this edit.':
    'Activa la fecha y hora automáticas antes de reintentar esta edición.',
  'Enter a nonnegative opening balance.': 'Introduce un saldo inicial no negativo.',
  'Enter a valid current balance with up to two decimals.':
    'Introduce un saldo actual válido con hasta dos decimales.',
  'Enter a valid date that is not in the future.': 'Introduce una fecha válida que no sea futura.',
  'Enter a valid nonnegative balance.': 'Introduce un saldo válido no negativo.',
  'Enter a valid opening balance.': 'Introduce un saldo inicial válido.',
  'Failed to fetch budgets': 'No se pudieron cargar los presupuestos.',
  'Failed to fetch categories': 'No se pudieron cargar las categorías.',
  'Failed to fetch profile.': 'No se pudo cargar el perfil.',
  'Failed to fetch recurring rules.': 'No se pudieron cargar las reglas recurrentes.',
  'Failed to fetch transactions': 'No se pudieron cargar las transacciones.',
  'Failed to load analytics': 'No se pudieron cargar los análisis.',
  'Failed to load dashboard': 'No se pudo cargar el panel.',
  'Favorite not found.': 'No se encontró el favorito.',
  'First day of the week must be a day name.': 'El primer día de la semana debe ser un día válido.',
  'Frequency must be DAY, WEEK, MONTH or YEAR.':
    'La frecuencia debe ser diaria, semanal, mensual o anual.',
  'Goal not found.': 'No se encontró la meta.',
  'Internal server error.': 'Error interno del servidor.',
  'Invalid "from" date.': 'La fecha inicial no es válida.',
  'Invalid "to" date.': 'La fecha final no es válida.',
  'Invalid "today" date.': 'La fecha actual no es válida.',
  'Invalid account ID.': 'Identificador de cuenta no válido.',
  'Invalid accountId.': 'Identificador de cuenta no válido.',
  'Invalid budget id.': 'Identificador de presupuesto no válido.',
  'Invalid category id.': 'Identificador de categoría no válido.',
  'Invalid categoryId.': 'Identificador de categoría no válido.',
  'Invalid clientId.': 'Identificador de cliente no válido.',
  'Invalid date.': 'Fecha no válida.',
  'Invalid email format.': 'El formato del correo no es válido.',
  'Invalid email or password.': 'Correo o contraseña incorrectos.',
  'Invalid end date.': 'Fecha de fin no válida.',
  'Invalid favorite ID.': 'Identificador de favorito no válido.',
  'Invalid import ID.': 'Identificador de importación no válido.',
  'Invalid or expired token.': 'La sesión no es válida o ha caducado.',
  'Invalid reassignment target category.': 'La categoría de destino no es válida.',
  'Invalid recurring rule id.': 'Identificador de regla recurrente no válido.',
  'Invalid tagId.': 'Identificador de etiqueta no válido.',
  'Invalid time zone.': 'Zona horaria no válida.',
  'Invalid transaction id.': 'Identificador de transacción no válido.',
  'Invalid transfer ID.': 'Identificador de transferencia no válido.',
  'Language must be en or es.': 'El idioma debe ser inglés o español.',
  'Login failed.': 'No se pudo iniciar sesión.',
  'Main must remain available.': 'La cuenta Main debe permanecer disponible.',
  'Main must remain available. Enter valid account details.':
    'La cuenta Main debe permanecer disponible. Introduce datos válidos.',
  'Name is required.': 'El nombre es obligatorio.',
  'Name, email and password are required.': 'Se requieren el nombre, el correo y la contraseña.',
  'Not found.': 'No encontrado.',
  'Nothing to update.': 'No hay cambios para actualizar.',
  'Password change failed.': 'No se pudo cambiar la contraseña.',
  'Period must be WEEK, MONTH or YEAR.': 'El período debe ser semanal, mensual o anual.',
  'Preview the file before importing.': 'Previsualiza el archivo antes de importarlo.',
  'Profile update failed.': 'No se pudo actualizar el perfil.',
  'Provide a valid amount, category of the same type, optional comment and 0–5 tags.':
    'Introduce un importe válido, una categoría del mismo tipo, un comentario opcional y de 0 a 5 etiquetas.',
  'Provide a valid mode, anchor, today and weekStart.': 'Introduce un período y fechas válidas.',
  'Provide unique category IDs in the requested order.':
    'Proporciona categorías sin duplicados en el orden solicitado.',
  'Recurring rule creation failed.': 'No se pudo crear la regla recurrente.',
  'Recurring rule delete failed.': 'No se pudo eliminar la regla recurrente.',
  'Recurring rule not found.': 'No se encontró la regla recurrente.',
  'Recurring rule update failed.': 'No se pudo actualizar la regla recurrente.',
  'Registration failed.': 'No se pudo crear la cuenta.',
  'Registration is disabled.': 'El registro está desactivado.',
  'Remove spending budgets before changing this category type.':
    'Elimina los presupuestos de gastos antes de cambiar el tipo de esta categoría.',
  'Search must be at most 100 characters.': 'La búsqueda debe tener como máximo 100 caracteres.',
  'Select 0–5 unique tags belonging to this account.':
    'Selecciona de 0 a 5 etiquetas diferentes de esta cuenta.',
  'Select unique movement rows to import.':
    'Selecciona filas de movimientos sin duplicados para importar.',
  'Tag not found.': 'No se encontró la etiqueta.',
  'Target category not found.': 'No se encontró la categoría de destino.',
  'The CSV contains no movements.': 'El CSV no contiene movimientos.',
  'The account no longer exists.': 'La cuenta ya no existe.',
  'The comparison period cannot start in the future.':
    'El período de comparación no puede empezar en el futuro.',
  'The device clock is ahead. Enable automatic date and time before retrying.':
    'El reloj del dispositivo está adelantado. Activa la fecha y hora automáticas antes de reintentar.',
  'The end date must be on or after the start date.':
    'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
  'The goal is archived.': 'La meta está archivada.',
  'The next occurrence changed. Refresh the rule; no other date was modified.':
    'La siguiente ocurrencia cambió. Actualiza la regla; no se modificó ninguna otra fecha.',
  'The restore selection is invalid. Preview the file again.':
    'La selección para restaurar no es válida. Vuelve a previsualizar el archivo.',
  'The selection contains unknown CSV rows.': 'La selección contiene filas desconocidas del CSV.',
  'The tag changed. Refresh and retry.': 'La etiqueta cambió. Actualiza e inténtalo de nuevo.',
  'This account already has a budget for that category and period.':
    'Esta cuenta ya tiene un presupuesto para esa categoría y período.',
  'This adjustment exceeds the supported range.': 'Este ajuste supera el rango permitido.',
  'This balance adjustment exceeds the supported range.':
    'Este ajuste de saldo supera el rango permitido.',
  'This occurrence has already been processed. Edit its movement instead.':
    'Esta ocurrencia ya fue procesada. Edita su movimiento.',
  'This restore ID belongs to a different backup.':
    'Este identificador de restauración pertenece a otra copia de seguridad.',
  'This session was revoked. Sign in again.': 'Esta sesión fue cerrada. Vuelve a iniciar sesión.',
  'This transfer would exceed the savings goal target.':
    'Esta transferencia superaría el objetivo de la meta de ahorro.',
  'Too many attempts. Please try again later.':
    'Demasiados intentos. Inténtalo de nuevo más tarde.',
  'Too many requests. Please slow down.': 'Demasiadas solicitudes. Espera un momento.',
  'Transaction creation failed.': 'No se pudo crear la transacción.',
  'Transaction not found.': 'No se encontró la transacción.',
  'Transaction update failed.': 'No se pudo actualizar la transacción.',
  'Transfer not found.': 'No se encontró la transferencia.',
  'Transfer savings through a normal account.':
    'Transfiere los ahorros mediante una cuenta normal.',
  'Unsupported currency code.': 'El código de moneda no está disponible.',
  'Update Porkex and explicitly retry this older edit before saving.':
    'Actualiza Porkex y reintenta esta edición antigua antes de guardar.',
  'Update Porkex before editing this movement.':
    'Actualiza Porkex antes de editar este movimiento.',
  'User not found.': 'No se encontró el usuario.',
  'Valid categoryId is required.': 'Se requiere una categoría válida.',
  'Week start must be a day name (e.g. MONDAY).': 'El inicio de la semana debe ser un día válido.',
  'clientId must be up to 64 characters of A-Z, a-z, 0-9, dash or underscore.':
    'El identificador de cliente debe tener hasta 64 letras, números, guiones o guiones bajos.'
}

export default errors
