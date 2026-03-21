import DemoOne from "@/components/demo";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <DemoOne />
      </main>

      <footer className="w-full py-4 text-center text-sm text-muted-foreground">
        Developed by{" "}
        <a
          href="https://hasindu.me"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline transition-colors"
        >
          Hasindu Nimesh
        </a>
      </footer>
    </div>
  );
}
