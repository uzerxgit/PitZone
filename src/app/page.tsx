import AttendanceCalculator from "@/components/attendance-calculator";
import { BotMessageSquare } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center gap-3">
             <BotMessageSquare className="h-10 w-10 text-primary" />
             <h1 className="font-headline text-4xl sm:text-5xl font-bold text-primary">
                PitZone
             </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Check you league stats, Manage, Rollout
          </p>
        </header>
        
        <AttendanceCalculator />

        <footer className="text-center text-muted-foreground/80 text-sm pt-8">
          <p>Make every leave count. Plan smart, Play well</p>
        </footer>
      </div>
    </main>
  );
}
