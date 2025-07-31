
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, isAfter, isSameDay, addDays } from "date-fns";
import { CalendarIcon, Calculator, Lightbulb, TrendingUp, TrendingDown, Info, Sparkles, LoaderCircle, Settings, X, Forward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { calculatePeriodsInRange, findRequiredAttendanceDate, setCustomPeriodSettings, CustomPeriodSettings } from "@/lib/attendance";
import { attendanceAdvisor } from "@/ai/flows/attendance-advisor";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  attendedPeriods: z.coerce.number().min(0, "Cannot be negative").optional(),
  totalPeriods: z.coerce.number().min(0, "Cannot be negative").optional(),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
}).refine(data => (data.totalPeriods ?? 0) >= (data.attendedPeriods ?? 0), {
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
  message: React.ReactNode;
} | null;

const initialCustomSettings: CustomPeriodSettings = {
    periods: [0, 6, 7, 8, 7, 6, 7], // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    percentage: 75,
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AttendanceCalculator() {
  const { toast } = useToast();
  const [result, setResult] = useState<ResultState>(null);
  const [simulationResult, setSimulationResult] = useState<ResultState>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [customSettings, setCustomSettings] = useState<CustomPeriodSettings>(initialCustomSettings);
  const [isCustomizationOpen, setCustomizationOpen] = useState(false);
  const [endDateMonth, setEndDateMonth] = useState<Date | undefined>(undefined);
  const [simulationMode, setSimulationMode] = useState<'apply' | 'project'>('apply');


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      attendedPeriods: undefined,
      totalPeriods: undefined,
      startDate: new Date(),
      endDate: undefined,
    },
  });
  
  useEffect(() => {
    const { endDate } = form.getValues();
    if (endDate && !endDateMonth) {
        setEndDateMonth(endDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.getValues().endDate]);

  const handleCalculate = (values: z.infer<typeof formSchema>) => {
    if (!isSameDay(values.startDate, values.endDate) && isAfter(values.startDate, values.endDate)) {
        toast({ title: "Invalid Date Range", description: "Start date cannot be after end date.", variant: "destructive" });
        return;
    }
    const attendedSoFar = values.attendedPeriods ?? 0;
    const totalSoFar = values.totalPeriods ?? 0;

    const periodsInDateRange = calculatePeriodsInRange(values.startDate, values.endDate);
    const finalTotal = totalSoFar + periodsInDateRange;
    const finalAttended = attendedSoFar + periodsInDateRange;

    if (finalTotal <= 0) {
        toast({ title: "No Periods Found", description: "Total periods are zero. Cannot calculate attendance.", variant: "destructive" });
        setResult(null);
        return;
    }
    
    const percentage = (finalAttended / finalTotal) * 100;
    const periodsToMaintain = Math.ceil(finalTotal * (customSettings.percentage / 100));
    const canMissPeriods = finalAttended - periodsToMaintain;
    const requiredDate = findRequiredAttendanceDate(finalAttended, finalTotal, values.endDate);

    let message: React.ReactNode = "You're on track! Keep it up.";
    if (percentage < customSettings.percentage) {
        message = requiredDate 
            ? <>You need to attend classes until {format(requiredDate, "PPP")} to reach {customSettings.percentage}% attendance.<br/>STAY OUT! STAY OUT! STAY OUT!</>
            : `You may not be able to reach ${customSettings.percentage}% attendance this year.`;
    } else if (canMissPeriods > 0) {
        message = <>{`You can afford to miss ${Math.floor(canMissPeriods)} period(s) and maintain ${customSettings.percentage}% attendance.`}<br/>GOLAZOO!</>;
    }

    setResult({ finalAttended, finalTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
    setSimulationResult(null);
    setAiAdvice(null);
  };
  
  const handleSimulate = (leaveAmount: number, type: 'periods' | 'days') => {
    if (!result) {
        toast({ title: "No Calculation Found", description: "Please calculate your attendance first.", variant: "destructive" });
        return;
    }

    let simAttended: number, simTotal: number;

    if (simulationMode === 'apply') {
        const periodsToLeave = type === 'days' 
            ? calculatePeriodsInRange(form.getValues().endDate, addDays(form.getValues().endDate, leaveAmount -1))
            : leaveAmount;
        
        simAttended = result.finalAttended - periodsToLeave;
        simTotal = result.finalTotal;
        
        if (simAttended < 0) {
            toast({ title: "Invalid Simulation", description: "Cannot take more leave than attended periods.", variant: "destructive" });
            return;
        }

    } else { // project
        const { endDate } = form.getValues();
        if (!endDate) return;

        let periodsToLeave;
        if (type === 'days') {
            const simulationStartDate = addDays(endDate, 1);
            const simulationEndDate = addDays(endDate, leaveAmount);
            periodsToLeave = calculatePeriodsInRange(simulationStartDate, simulationEndDate);
        } else {
            periodsToLeave = leaveAmount;
        }
        
        simAttended = result.finalAttended;
        simTotal = result.finalTotal + periodsToLeave;
    }


    if (simTotal <= 0) {
        toast({ title: "Invalid Simulation", description: "Total periods are zero.", variant: "destructive" });
        return;
    }

    const percentage = (simAttended / simTotal) * 100;
    const periodsToMaintain = Math.ceil(simTotal * (customSettings.percentage / 100));
    const canMissPeriods = simAttended - periodsToMaintain;
    const { endDate } = form.getValues();
    const requiredDate = findRequiredAttendanceDate(simAttended, simTotal, endDate);
    
    let message: React.ReactNode = "You're still on track after the leave!";
     if (percentage < customSettings.percentage) {
        message = requiredDate 
            ? <>After leave, you must attend until {format(requiredDate, "PPP")} to reach {customSettings.percentage}%.<br/>YOU SEAT IS FULL OF WATER!!</>
            : `After leave, you may not reach ${customSettings.percentage}% attendance this year.`;
    } else if (canMissPeriods > 0) {
        message = `After leave, you can still miss ${Math.floor(canMissPeriods)} period(s).`;
    }

    setSimulationResult({ finalAttended: Math.floor(simAttended), finalTotal: simTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
  };

  const handleGetAiAdvice = async () => {
    if (!result) return;
    setIsLoadingAi(true);
    setAiAdvice(null);
    const { startDate, endDate, attendedPeriods, totalPeriods } = form.getValues();

    try {
      const res = await attendanceAdvisor({
        attendedPeriods: attendedPeriods ?? 0,
        totalPeriods: totalPeriods ?? 0,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate || startDate, 'yyyy-MM-dd'),
      });
      setAiAdvice(res.recommendation);
    } catch (e) {
      toast({
        title: "Error getting AI advice",
        description: "Could not get advice from the AI. Please try again later.",
        variant: "destructive"
      });
    }
    setIsLoadingAi(false);
  };

  const handleSettingsSave = () => {
    setCustomPeriodSettings(customSettings);
    setCustomizationOpen(false);
    // Recalculate if form has values
    if (form.getValues().endDate) {
      handleCalculate(form.getValues());
    }
  };

  const ResultCard = ({ res, title, icon }: { res: ResultState, title: string, icon: React.ReactNode }) => {
    if (!res) return null;
    const isBelowThreshold = res.percentage < customSettings.percentage;
    return (
        <Card className="shadow-lg animate-in fade-in-0 zoom-in-95 duration-500">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
                <CardDescription>{res.message}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className={cn("p-4 rounded-lg", isBelowThreshold ? "bg-destructive/10" : "bg-primary/10")}>
                    <p className="text-sm text-muted-foreground">Attendance</p>
                    <p className={cn("text-3xl font-bold", isBelowThreshold ? "text-destructive" : "text-primary")}>{res.percentage.toFixed(2)}%</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground">Periods</p>
                    <p className="text-3xl font-bold">{Math.floor(res.finalAttended)}/{res.finalTotal}</p>
                </div>
                <div className="p-4 rounded-lg bg-secondary">
                    <p className="text-sm text-muted-foreground">Need for {customSettings.percentage}%</p>
                    <p className="text-3xl font-bold">{res.periodsToMaintain}</p>
                </div>
                 <div className={cn("p-4 rounded-lg", res.canMissPeriods < 0 ? "bg-destructive/10" : "bg-green-500/10")}>
                    <p className="text-sm text-muted-foreground">Buffer Periods</p>
                    <p className={cn("text-3xl font-bold", res.canMissPeriods < 0 ? "text-destructive" : "text-green-600")}>
                        {res.canMissPeriods >= 0 ? `+${Math.floor(res.canMissPeriods)}` : Math.ceil(res.canMissPeriods)}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Radio Check!</CardTitle>
              <CardDescription>Enter your current attendance and select the date range for calculation.</CardDescription>
            </div>
             <Dialog open={isCustomizationOpen} onOpenChange={setCustomizationOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="icon"><Settings className="h-5 w-5" /></Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Customize Calculation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Periods per Day</Label>
                            <div className="grid grid-cols-7 gap-2">
                                {dayLabels.map((day, i) => (
                                    <div key={i} className="flex flex-col items-center gap-1">
                                        <Label htmlFor={`day-${i}`} className="text-xs text-muted-foreground">{day}</Label>
                                        <Input
                                            id={`day-${i}`}
                                            type="number"
                                            value={customSettings.periods[i] === 0 ? '' : customSettings.periods[i]}
                                            onChange={(e) => {
                                                const newPeriods = [...customSettings.periods];
                                                const value = e.target.value;
                                                const parsedValue = parseInt(value, 10);
                                                newPeriods[i] = isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue;
                                                setCustomSettings({ ...customSettings, periods: newPeriods });
                                            }}
                                            className="text-center"
                                            placeholder="-"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Required Attendance Percentage</Label>
                            <Input
                                type="number"
                                value={customSettings.percentage === 0 ? '' : customSettings.percentage}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const parsedValue = parseInt(value, 10);
                                    const newPercentage = isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue > 100 ? 100 : parsedValue;
                                    setCustomSettings({ ...customSettings, percentage: newPercentage });
                                }}
                                onBlur={(e) => {
                                     if(e.target.value === '') {
                                         setCustomSettings({...customSettings, percentage: 0});
                                     }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                           <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button onClick={handleSettingsSave}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCalculate)} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <FormField control={form.control} name="attendedPeriods" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periods Attended (So Far)</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g., 80" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                            value={field.value ?? ''}
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="totalPeriods" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Periods (So Far)</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            placeholder="e.g., 100" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
                            value={field.value ?? ''}
                        />
                    </FormControl>
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
                            <Calendar 
                                mode="single" 
                                selected={field.value} 
                                onSelect={(date) => {
                                    field.onChange(date);
                                    if (date) {
                                        setEndDateMonth(date);
                                    }
                                }}
                                onMonthChange={setEndDateMonth}
                                month={endDateMonth}
                                initialFocus
                            />
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
            
            {simulationResult && <ResultCard res={simulationResult} title="Simulation Result" icon={simulationMode === 'apply' ? <TrendingDown className="text-accent" /> : <Forward className="text-accent" />} />}

            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Info /> Leave Simulation</CardTitle>
                            <CardDescription>See how taking a leave affects your lap time.</CardDescription>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Label htmlFor="sim-mode" className="text-sm font-medium">{simulationMode === 'apply' ? 'Apply Leave' : 'Project Future'}</Label>
                            <Switch 
                                id="sim-mode" 
                                checked={simulationMode === 'project'}
                                onCheckedChange={(checked) => setSimulationMode(checked ? 'project' : 'apply')}
                            />
                        </div>
                    </div>
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
