
"use client";

import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, addDays, isSameDay, isAfter, startOfDay } from "date-fns";
import { CalendarIcon, Calculator, TrendingUp, TrendingDown, Info, Settings, Forward, Bot, LoaderCircle } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { getAttendanceAdvice } from "@/ai/flows/attendance-advisor";
import { AttendanceRequest } from "@/ai/schemas/attendance-request";


const formSchema = z.object({
  attendedPeriods: z.coerce.number().min(0, "Cannot be negative").optional(),
  totalPeriods: z.coerce.number().min(0, "Cannot be negative").optional(),
  startDate: z.date({ required_error: "Start date is required." }),
  endDate: z.date({ required_error: "End date is required." }),
}).refine(data => {
    if (data.startDate && data.endDate) {
        return !isAfter(startOfDay(data.startDate), startOfDay(data.endDate));
    }
    return true;
}, {
  message: "Start date cannot be after end date.",
  path: ["startDate"],
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
  const [customSettings, setCustomSettings] = useState<CustomPeriodSettings>(initialCustomSettings);
  const [isCustomizationOpen, setCustomizationOpen] = useState(false);
  const [simulationMode, setSimulationMode] = useState<'project' | 'apply'>('project');
  const [simulationLeaveAmount, setSimulationLeaveAmount] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      attendedPeriods: undefined,
      totalPeriods: undefined,
      startDate: new Date(),
      endDate: new Date(),
    },
  });

  useEffect(() => {
    if (isMounted) {
      const today = new Date();
      form.setValue('startDate', today);
      form.setValue('endDate', today);
    }
  }, [isMounted, form]);

  const handleCalculate = (values: z.infer<typeof formSchema>) => {
    const attendedSoFar = values.attendedPeriods ?? 0;
    const totalSoFar = values.totalPeriods ?? 0;

    let periodsInDateRange = 0;
    if (values.startDate && values.endDate && !isAfter(startOfDay(values.startDate), startOfDay(values.endDate))) {
      periodsInDateRange = calculatePeriodsInRange(values.startDate, values.endDate);
    }

    const finalTotal = totalSoFar + periodsInDateRange;
    const finalAttended = attendedSoFar + periodsInDateRange;

    if (finalTotal <= 0) {
        toast({ title: "No Periods Found", description: "Total periods are zero for the selected range. Check your custom settings.", variant: "destructive" });
        setResult(null);
        return;
    }
    
    const percentage = (finalAttended / finalTotal) * 100;
    const periodsToMaintain = Math.ceil(finalTotal * (customSettings.percentage / 100));
    const canMissPeriods = finalAttended - periodsToMaintain;
    const requiredDate = findRequiredAttendanceDate(finalAttended, finalTotal, values.endDate);

    let message: React.ReactNode = "You're on track! Keep it up.";
    if (percentage < customSettings.percentage) {
        message = <>YOUR SEAT is FULL OF Water</>;
    } else if (canMissPeriods > 0) {
        message = <>STAY OUT STAY OUT STAY OUT</>;
    }

    setResult({ finalAttended, finalTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
    setSimulationResult(null);
    setAiAdvice("");
  };

   const handleGetAiAdvice = async () => {
    if (!result) {
        toast({ title: "No Calculation Found", description: "Please calculate your attendance first.", variant: "destructive" });
        return;
    }

    setIsAiLoading(true);
    setAiAdvice("");

    try {
        const advice = await getAttendanceAdvice({
            attended: result.finalAttended,
            total: result.finalTotal,
            requiredPercentage: customSettings.percentage,
        });
        setAiAdvice(advice);
    } catch (error) {
        console.error("AI Advisor Error:", error);
        toast({ title: "AI Advisor Error", description: "Could not get advice at this time.", variant: "destructive" });
    } finally {
        setIsAiLoading(false);
    }
  };
  
  const handleSimulate = (type: 'periods' | 'days') => {
    if (!result) {
        toast({ title: "No Calculation Found", description: "Please calculate your attendance first.", variant: "destructive" });
        return;
    }
    
    const leaveAmount = parseInt(simulationLeaveAmount) || 0;
    if (leaveAmount <= 0) {
        toast({ title: "Invalid Input", description: "Please enter a positive number for leave.", variant: "destructive" });
        return;
    }

    let simAttended: number, simTotal: number;
    const { endDate } = form.getValues();
    if (!endDate) return;

    if (simulationMode === 'apply') {
        const periodsToLeave = type === 'days' 
            ? calculatePeriodsInRange(endDate, addDays(endDate, leaveAmount -1))
            : leaveAmount;
        
        simAttended = result.finalAttended - periodsToLeave;
        simTotal = result.finalTotal;
        
        if (simAttended < 0) {
            toast({ title: "Invalid Simulation", description: "Cannot take more leave than attended periods.", variant: "destructive" });
            return;
        }

    } else { // project
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
    const requiredDate = findRequiredAttendanceDate(simAttended, simTotal, endDate);
    
    let message: React.ReactNode = "You're still on track after the leave!";
     if (percentage < customSettings.percentage) {
        message = requiredDate 
            ? <>After leave, you must attend until <strong>{format(requiredDate, "PPP")}</strong> to reach {customSettings.percentage}%.</>
            : `After leave, you may not reach ${customSettings.percentage}% attendance this year.`;
    } else if (canMissPeriods > 0) {
        message = `After leave, you can still miss <strong>${Math.floor(canMissPeriods)}</strong> period(s).`;
    }

    setSimulationResult({ finalAttended: Math.floor(simAttended), finalTotal: simTotal, percentage, periodsToMaintain, canMissPeriods, requiredDate, message });
  };

  const handleSettingsSave = () => {
    setCustomPeriodSettings(customSettings);
    setCustomizationOpen(false);
    if (form.formState.isSubmitted) {
      form.handleSubmit(handleCalculate)();
    }
  };

  if (!isMounted) {
    return null;
  }
  
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
  
  const AIAdvisorCard = () => {
    if (!result) return null;
    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bot /> AI Attendance Advisor</CardTitle>
                <CardDescription>Get personalized advice based on your current attendance status.</CardDescription>
            </CardHeader>
            <CardContent>
                {isAiLoading && <div className="flex items-center justify-center p-4"><LoaderCircle className="h-6 w-6 animate-spin text-primary" /> <p className="ml-2">Getting advice...</p></div>}
                {!isAiLoading && aiAdvice && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{aiAdvice}</p>}
                {!isAiLoading && !aiAdvice && <p className="text-sm text-muted-foreground">Click the button to get AI-powered advice.</p>}
            </CardContent>
            <CardFooter>
                <Button onClick={handleGetAiAdvice} disabled={isAiLoading} className="w-full">
                   {isAiLoading ? "Thinking..." : "Get AI Advice"}
                </Button>
            </CardFooter>
        </Card>
    );
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Attendance Calculator</CardTitle>
              <CardDescription>Enter current attendance and select a date range for calculation.</CardDescription>
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
                                            value={customSettings.periods[i]}
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
                                value={customSettings.percentage}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const parsedValue = parseInt(value, 10);
                                    let newPercentage = isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue > 100 ? 100 : parsedValue;
                                    setCustomSettings({ ...customSettings, percentage: newPercentage });
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
                           <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                            />
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
                                onSelect={field.onChange}
                                month={form.getValues().endDate || form.getValues().startDate || new Date()}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <Button type="submit" className="w-full" size="lg">
                <Calculator className="mr-2 h-5 w-5" /> GOLAZO
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
                            <CardDescription>See how taking leave affects your attendance.</CardDescription>
                        </div>
                         <div className="flex items-center space-x-2">
                            <Label htmlFor="sim-mode" className="text-sm font-medium">{simulationMode === 'project' ? 'Project Future' : 'Apply Leave'}</Label>
                            <Switch 
                                id="sim-mode" 
                                checked={simulationMode === 'project'}
                                onCheckedChange={(checked) => setSimulationMode(checked ? 'project' : 'apply')}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="days">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="days">By Days</TabsTrigger>
                            <TabsTrigger value="periods">By Periods</TabsTrigger>
                        </TabsList>
                        <TabsContent value="days" className="pt-4">
                             <div className="flex gap-4">
                                <Input type="number" placeholder="No. of days" className="flex-grow" value={simulationLeaveAmount} onChange={(e) => setSimulationLeaveAmount(e.target.value)} />
                                <Button onClick={() => handleSimulate('days')}>Simulate</Button>
                            </div>
                        </TabsContent>
                        <TabsContent value="periods" className="pt-4">
                            <div className="flex gap-4">
                                <Input type="number" placeholder="No. of periods" className="flex-grow" value={simulationLeaveAmount} onChange={(e) => setSimulationLeaveAmount(e.target.value)} />
                                <Button onClick={() => handleSimulate('periods')}>Simulate</Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
            <AIAdvisorCard />
        </>
      )}
    </div>
  );
}
