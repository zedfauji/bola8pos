import { Link } from 'react-router-dom'

export default function App() {
  return (
    <div className="min-h-full p-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">POS Billiards & Bar</h1>
      </header>
      <nav className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Link to="/tables" className="rounded-lg bg-[#1E90FF] text-white p-6 text-center text-lg">Mesas</Link>
        <Link to="/orders" className="rounded-lg bg-[#32CD32] text-white p-6 text-center text-lg">Ordenes</Link>
        <Link to="/kds" className="rounded-lg bg-yellow-400 text-black p-6 text-center text-lg">Cocina</Link>
        <Link to="/loyalty" className="rounded-lg bg-purple-700 text-white p-6 text-center text-lg">Lealtad</Link>
        <Link to="/employees" className="rounded-lg bg-[#1E90FF] text-white p-6 text-center text-lg">Empleados</Link>
      </nav>
    </div>
  )
}
