import { APITester } from "./APITester";
import { SimulationForm } from "./components/SimulationForm";
import "./index.css";

export function App() {
  return (
    <div className="container mx-auto max-w-3xl p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Pre-Auth Agent</h1>
        <p className="mt-2 text-muted-foreground">
          Simulador de solicitudes de pre autorizacion con IA (Notion + OpenAI)
        </p>
      </header>
      <SimulationForm />
      <div className="mt-8">
        <APITester />
      </div>
    </div>
  );
}

export default App;