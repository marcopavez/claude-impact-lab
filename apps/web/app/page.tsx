export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl w-full space-y-8">
        <header className="text-center space-y-3">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">
            Vigía
          </h1>
          <p className="text-xl text-slate-600">
            Secretaria con firewall de identidad para llamadas
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-8 space-y-4 shadow-sm">
          <p className="text-slate-700 leading-relaxed">
            Protege a adultos mayores chilenos contra estafas telefónicas. La
            llamada al celular protegido se desvía al número Vigía, donde{" "}
            <span className="font-semibold text-slate-900">Claude</span>{" "}
            analiza en tiempo real, autentica al llamante con un protocolo
            multi-factor, y decide transferir, tomar mensaje o colgar.
          </p>
          <div className="pt-3 text-sm text-slate-500 border-t border-slate-100">
            Línea 02 · Ciberseguridad Ciudadana · Claude Impact Lab Chile 2026
          </div>
        </section>

        <footer className="text-center">
          <p className="text-sm text-slate-400">
            MVP en construcción · 6 mayo 2026
          </p>
        </footer>
      </div>
    </main>
  );
}
