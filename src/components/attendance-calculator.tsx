
"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, isAfter } from "date-fns";
import { CalendarIcon, Calculator, Lightbulb, TrendingUp, TrendingDown, Info, Sparkles, LoaderCircle, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculatePeriodsInRange, findRequiredAttendanceDate } from "@/lib/attendance";
import { getAttendanceAdvice } from "@/lib/actions";

const formSchema = z.object({
  attendedPeriods: z.coerce.number().min(0, "Cannot be negative"),
  totalPeriods: z.coerce.number().min(0, "Cannot be negative"),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
}).refine(data => data.totalPeriods >= data.attendedPeriods, {
    message: "Total periods cannot be less than attended periods.",
    path: ["totalPeriods"],
});

type ResultState = {
  finalAttended: number;
  finalTotal: number;
  percentage: number;
  periodsToMaintain: number;
  canMissPeriods: number;
  requiredDate: Date | null;
  message: string;
} | null;

export default function AttendanceCalculator() {
  const { toast } = useToast();
  const [result, setResult] = useState<ResultState>(null);
  const [simulationResult, setSimulationResult] = useState<ResultState>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      attendedPeriods: 0,
      totalPeriods: 0,
      startDate: new Date(),
      endDate: new Date(),
    },
  });

  const handleCalculate = (values: z.infer<typeof formSchema>) => {
    if (isAfter(values.startDate, values.endDate)) {
        toast({ title: "Invalid Date Range", description: "Start date cannot be after end date.", variant: "destructive" });
        return;
    }

    const periodsInDateRange = calculatePeriodsInRange(values.startDate, values.endDate);
    const finalTotal = values.totalPeriods + periodsInDateRange;
    const finalAttended = values.attendedPeriods; // Assuming initial attended is up to start date

    if (finalTotal <= 0) {
        toast({ title: "No Periods Found", description: "Total periods are zero. Cannot calculate attendance.", variant: "destructive" });
        setResult(null);
        return;
    }
    
    const percentage = (finalAttended / finalTotal) * 100;
    const periodsToMaintain = Math.ceil(finalTotal * 0.75);
    const canMissPeriods = finalAttended - periodsToMaintain;
    const requiredDate = findRequiredAttendanceDate(finalAttended, finalTotal, values.endDate);

    let message = "You're on track! Keep it up.";
    if (percentage < 75) {
        message = requiredDate 
            ? `You need to attend classes until ${format(requiredDate, "PPP")} to reach 75% attendance.`
            : "You may not be able to reach 75% attendance this year.";
    } else if (canMissPeriods > 0) {
        message = `You can afford to miss ${canMissPeriods} period(s) and maintain 75% attendance.`;
    }

    setResult({ finalAttended, finalTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
    setSimulationResult(null); // Reset simulation on new calculation
    setAiAdvice(null);
  };
  
  const handleSimulate = (leaveAmount: number, type: 'periods' | 'days') => {
    if (!result) {
        toast({ title: "No Calculation Found", description: "Please calculate your attendance first.", variant: "destructive" });
        return;
    }
    
    const periodsToLeave = type === 'days' ? leaveAmount * 6 : leaveAmount; // Assuming 6 periods per day for simulation
    const simAttended = result.finalAttended - periodsToLeave;
    const simTotal = result.finalTotal;

    if (simAttended < 0) {
        toast({ title: "Invalid Simulation", description: "Cannot take more leave than attended periods.", variant: "destructive" });
        return;
    }

    const percentage = (simAttended / simTotal) * 100;
    const periodsToMaintain = result.periodsToMaintain;
    const canMissPeriods = simAttended - periodsToMaintain;
    const { endDate } = form.getValues();
    const requiredDate = findRequiredAttendanceDate(simAttended, simTotal, endDate);
    
    let message = "You're still on track after the leave!";
     if (percentage < 75) {
        message = requiredDate 
            ? `After leave, you must attend until ${format(requiredDate, "PPP")} to reach 75%.`
            : "After leave, you may not reach 75% attendance this year.";
    } else if (canMissPeriods > 0) {
        message = `After leave, you can still miss ${canMissPeriods} period(s).`;
    }

    setSimulationResult({ finalAttended: simAttended, finalTotal: simTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
  };

  const handleGetAiAdvice = async () => {
    if (!result) return;
    setIsLoadingAi(true);
    setAiAdvice(null);
    const { startDate, endDate } = form.getValues();

    const advice = await getAttendanceAdvice({
      attendedPeriods: result.finalAttended,
      totalPeriods: result.finalTotal,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    });
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  const ResultCard = ({ res, title, icon }: { res: ResultState, title: string, icon: React.ReactNode }) => {
    if (!res) return null;
    const isBelow75 = res.percentage < 75;
    return (
        <Card className="shadow-lg animate-in fade-in-0 zoom-in-95 duration-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
                <CardDescription>{res.message}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className={cn("p-4 rounded-lg", isBelow75 ? "bg-destructive/10" : "bg-primary/10")}>
                    <p className="text-sm text-muted-foreground">Attendance</p>
                    <p className={cn("text-3xl font-bold", isBelow75 ? "text-destructive" : "text-primary")}>{res.percentage.toFixed(2)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground">Periods</p>
                    <p className="text-3xl font-bold">{res.finalAttended}/{res.finalTotal}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground">Need for 75%</p>
                    <p className="text-3xl font-bold">{res.periodsToMaintain}</p>
                </div>
                 <div className={cn("p-4 rounded-lg", res.canMissPeriods < 0 ? "bg-destructive/10" : "bg-green-500/10")}>
                    <p className="text-sm text-muted-foreground">Buffer Periods</p>
                    <p className={cn("text-3xl font-bold", res.canMissPeriods < 0 ? "text-destructive" : "text-green-600")}>
                        {res.canMissPeriods >= 0 ? `+${res.canMissPeriods}` : res.canMissPeriods}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Attendance Details</CardTitle>
          <CardDescription>Enter your current attendance and select the date range for calculation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCalculate)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="attendedPeriods" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periods Attended (So Far)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 80" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="totalPeriods" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Periods (So Far)</FormLabel>
                    <FormControl><Input type="number" placeholder="e.g., 100" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>End Date</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" size="lg">
                <Calculator className="mr-2 h-5 w-5" /> Calculate Attendance
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {result && (
        <>
            <ResultCard res={result} title="Calculation Result" icon={<TrendingUp className="text-primary" />} />
            
            {simulationResult && <ResultCard res={simulationResult} title="Simulation Result" icon={<TrendingDown className="text-accent" />} />}

            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Info /> Leave Simulation</CardTitle>
                    <CardDescription>See how taking a leave affects your attendance.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="periods">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="periods">By Periods</TabsTrigger>
                            <TabsTrigger value="days">By Days</TabsTrigger>
                        </TabsList>
                        <TabsContent value="periods" className="pt-4">
                            <div className="flex gap-4">
                                <Input id="periods-leave" type="number" placeholder="No. of periods" className="flex-grow" />
                                <Button onClick={() => handleSimulate(parseInt((document.getElementById('periods-leave') as HTMLInputElement).value || '0'), 'periods')}>Simulate</Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="days" className="pt-4">
                             <div className="flex gap-4">
                                <Input id="days-leave" type="number" placeholder="No. of days" className="flex-grow" />
                                <Button onClick={() => handleSimulate(parseInt((document.getElementById('days-leave') as HTMLInputElement).value || '0'), 'days')}>Simulate</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

             <Card className="shadow-lg bg-gradient-to-br from-primary/10 via-background to-accent/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="text-accent" /> AI Attendance Advisor</CardTitle>
                    <CardDescription>Get a personalized recommendation from our AI to balance your studies and well-being.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingAi && (
                        <div className="flex items-center justify-center p-6 text-muted-foreground">
                            <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                            Generating your personal advice...
                        </div>
                    )}
                    {aiAdvice && (
                         <div className="p-4 bg-accent/20 rounded-lg text-accent-foreground flex gap-3">
                            <Lightbulb className="h-5 w-5 mt-1 text-accent shrink-0"/>
                            <p className="font-medium">{aiAdvice}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                     <Button onClick={handleGetAiAdvice} disabled={isLoadingAi} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                        {isLoadingAi ? <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> : <Lightbulb className="mr-2 h-5 w-5" />}
                        Get AI Advice
                    </Button>
                </CardFooter>
            </Card>
        </>
      )}
    </div>
  );
}
