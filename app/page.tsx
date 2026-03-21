import DemoOne from "@/components/demo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <DemoOne />

      <footer className="fixed bottom-0 left-0 right-0 py-4 text-center text-sm text-muted-foreground">
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
    </main>
  );
}
