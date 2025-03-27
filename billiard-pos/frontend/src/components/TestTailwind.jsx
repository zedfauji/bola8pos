export default function TestTailwind() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-4xl font-bold text-blue-600 mb-6">Tailwind Test</h1>
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <p className="text-lg mb-4">If you see:</p>
        <ul className="list-disc pl-6 mb-6">
          <li className="text-green-500">Blue heading → Base styles work</li>
          <li className="text-green-500">White card → Utilities work</li>
          <li className="text-green-500">This list → Components work</li>
        </ul>
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Test Button
        </button>
      </div>
    </div>
  );
}
