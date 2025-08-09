import { useState } from 'react'

type Employee = { id: string; name: string; role: 'cajero' | 'gerente' | 'cocina'; hours: number; sales: number }
const MOCK: Employee[] = [
  { id: 'e1', name: 'Carlos', role: 'cajero', hours: 38, sales: 12000 },
  { id: 'e2', name: 'Marta', role: 'cocina', hours: 42, sales: 0 },
  { id: 'e3', name: 'Luis', role: 'gerente', hours: 45, sales: 5000 },
]

export default function Employees() {
  const [employees] = useState<Employee[]>(MOCK)

  function addShift() {
    alert('Agregar turno (UI placeholder)')
  }

  function exportPayroll() {
    const csv = ['id,name,role,hours,sales', ...employees.map((e) => `${e.id},${e.name},${e.role},${e.hours},${e.sales}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'payroll.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Empleados</h2>
      <div className="mb-3 flex gap-2">
        <button onClick={addShift} className="bg-[#1E90FF] text-white rounded px-3 py-2">Agregar Turno</button>
        <button onClick={exportPayroll} className="bg-[#32CD32] text-white rounded px-3 py-2">Exportar Nómina</button>
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left p-2">Nombre</th>
              <th className="text-left p-2">Rol</th>
              <th className="text-right p-2">Horas</th>
              <th className="text-right p-2">Ventas</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.name}</td>
                <td className="p-2 capitalize">{e.role}</td>
                <td className="p-2 text-right">{e.hours}</td>
                <td className="p-2 text-right">${e.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}