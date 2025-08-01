
import { isAfter, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';

export interface CustomPeriodSettings {
    periods: number[]; // Sun -> Sat
    percentage: number;
}

let currentSettings: CustomPeriodSettings = {
    periods: [0, 6, 7, 8, 7, 6, 7], // Sun, Mon, Tue, Wed, Thu, Fri, Sat
    percentage: 75,
};

// Cache for generated year data to avoid redundant calculations
const yearDataCache: { [year: number]: number[][] } = {};

export const setCustomPeriodSettings = (settings: CustomPeriodSettings) => {
    currentSettings = settings;
    // Clear cache when settings change
    Object.keys(yearDataCache).forEach(key => delete yearDataCache[parseInt(key)]);
};

const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const generateYearData = (year: number): number[][] => {
    if (yearDataCache[year]) {
        return yearDataCache[year];
    }

    const yearData: number[][] = [];
    let dayOfWeek = new Date(year, 0, 1).getDay(); // 0=Sun, 1=Mon...

    const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 0; m < 12; m++) {
        const month: number[] = [];
        for (let d = 0; d < monthLengths[m]; d++) {
            month.push(currentSettings.periods[dayOfWeek]);
            dayOfWeek = (dayOfWeek + 1) % 7;
        }
        yearData.push(month);
    }
    
    // Hardcoded holidays for a specific academic calendar.
    // This section could be made dynamic if holiday data was available from an API.
    const holidays: { [month: number]: number[] } = {
        6: [18], // July
        7: [14, 16, 23, 26], // August
        8: [4, 20, 28, 29], // September
        9: [0, 1, 2, 3, 18, 19], // October
        10: [4, 14], // November
        11: [24], // December
    };

    for (const monthIndexStr in holidays) {
        const monthIndex = parseInt(monthIndexStr, 10);
        if (yearData[monthIndex]) {
            holidays[monthIndex].forEach(dayIndex => {
                if (yearData[monthIndex][dayIndex] !== undefined) {
                    yearData[monthIndex][dayIndex] = 0;
                }
            });
        }
    }
    
    yearDataCache[year] = yearData;
    return yearData;
};

export const calculatePeriodsInRange = (startDate: Date, endDate: Date): number => {
    if (!startDate || !endDate || isAfter(startOfDay(startDate), startOfDay(endDate))) {
        return 0;
    }

    const sDate = startOfDay(startDate);
    const eDate = startOfDay(endDate);

    let totalPeriods = 0;
    let currentDate = new Date(sDate);

    while (currentDate.getTime() <= eDate.getTime()) {
        const yearData = generateYearData(currentDate.getFullYear());
        const month = currentDate.getMonth();
        const day = currentDate.getDate() - 1; // day is 0-indexed

        if (yearData[month]?.[day] !== undefined) {
            totalPeriods += yearData[month][day];
        }
        currentDate = addDays(currentDate, 1);
    }
    
    return totalPeriods;
};

export const findRequiredAttendanceDate = (
    currentAttended: number,
    currentTotal: number,
    checkFromDate: Date,
): Date | null => {
    if (!checkFromDate) return null;
    const requiredPercentage = currentSettings.percentage / 100;
    if (currentTotal > 0 && (currentAttended / currentTotal) >= requiredPercentage) {
        return null;
    }
    
    let tempAttended = currentAttended;
    let tempTotal = currentTotal;

    // Limit search to 2 years to prevent infinite loops
    const limitDate = addDays(checkFromDate, 365 * 2); 
    let currentDate = startOfDay(checkFromDate);

    while(currentDate <= limitDate) {
        const yearData = generateYearData(currentDate.getFullYear());
        const month = currentDate.getMonth();
        const day = currentDate.getDate() - 1;
        
        const periodsToday = yearData[month]?.[day];

        if (periodsToday !== undefined) {
            tempAttended += periodsToday;
            tempTotal += periodsToday;
        }

        if (tempTotal > 0 && (tempAttended / tempTotal) >= requiredPercentage) {
            return currentDate;
        }

        currentDate = addDays(currentDate, 1);
    }
    
    return null; // Cannot reach threshold within the time limit
};
