$file = "src\lib\pending-nav.ts"
$content = Get-Content $file -Raw

# Replace the function to use default role
$old = @'
    // Generar URL según el rol del usuario - formatos exactos
    if (isUserAdmin(userRole)) {
      // Admin: /admin/proyectos/{id}?view=CHAT
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (userRole === 'SUBCONTRATISTA' || userRole?.toUpperCase() === 'SUBCONTRATISTA') {
      // Subcontratista: /admin/subcontratista/proyecto/{id}?view=chat
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      // Operador: /admin/operador/proyecto/{id}?view=chat
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  // Otros formatos
'@

$new = @'
    // FIX v424: Determinar el rol (por defecto OPERADOR si no está definido)
    const role = userRole || 'OPERADOR';

    // Generar URL según el rol del usuario - formatos exactos
    if (isUserAdmin(role)) {
      // Admin: /admin/proyectos/{id}?view=CHAT
      return `/admin/proyectos/${projectId}?view=CHAT`;
    } else if (role === 'SUBCONTRATISTA' || role.toUpperCase() === 'SUBCONTRATISTA') {
      // Subcontratista: /admin/subcontratista/proyecto/{id}?view=chat
      return `/admin/subcontratista/proyecto/${projectId}?view=chat`;
    } else {
      // Operador: /admin/operador/proyecto/{id}?view=chat
      return `/admin/operador/proyecto/${projectId}?view=chat`;
    }
  }
  
  // Otros formatos
'@

$content = $content.Replace($old, $new)
Set-Content $file $content -NoNewline
Write-Host "Fix applied"