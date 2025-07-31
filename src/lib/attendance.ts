
import { isAfter, isSameDay } from 'date-fns';

type YearData = number[][];

export interface CustomPeriodSettings {
    periods: number[]; // Sun -> Sat
    percentage: number;
}

let currentSettings: CustomPeriodSettings = {
    periods: [0, 6, 7, 8, 7, 6, 7], // Sun -> Sat
    percentage: 75,
};

export const setCustomPeriodSettings = (settings: CustomPeriodSettings) => {
    currentSettings = settings;
};

const isLeapYear = (year: number): boolean => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

const generateYearData = (year: number): YearData => {
    const yearData: YearData = [];
    let dayOfWeek = new Date(year, 0, 1).getDay(); // Get day of week for Jan 1st (0=Sun, 1=Mon...)

    const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 0; m < 12; m++) {
        const month: number[] = [];
        for (let d = 0; d < monthLengths[m]; d++) {
            month.push(currentSettings.periods[dayOfWeek]);
            dayOfWeek = (dayOfWeek + 1) % 7;
        }
        yearData.push(month);
    }

    const holidays: { [month: number]: number[] } = {
        6: [18],
        7: [14, 16, 23, 26],
        8: [4, 20, 28, 29],
        9: [0, 1, 2, 3, 18, 19],
        10: [4, 14],
        11: [24],
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
    return yearData;
};

export const calculatePeriodsInRange = (startDate: Date, endDate: Date): number => {
    if (isAfter(startDate, endDate)) return 0;
    
    // For single day calculation
    if (isSameDay(startDate, endDate)) {
        const yearData = generateYearData(startDate.getFullYear());
        const month = startDate.getMonth();
        const day = startDate.getDate() - 1;

        if (yearData[month] && yearData[month][day] !== undefined) {
            return yearData[month][day];
        }
        return 0;
    }

    let totalPeriods = 0;
    
    // Handle multi-year ranges by iterating through each year
    for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
        const yearData = generateYearData(year);
        const currentYearStartDate = (year === startDate.getFullYear()) ? startDate : new Date(year, 0, 1);
        const currentYearEndDate = (year === endDate.getFullYear()) ? endDate : new Date(year, 11, 31);

        const startMonth = currentYearStartDate.getMonth();
        const startDay = currentYearStartDate.getDate() - 1;
        const endMonth = currentYearEndDate.getMonth();
        const endDay = currentYearEndDate.getDate() - 1;

        for (let m = startMonth; m <= endMonth; m++) {
            const monthData = yearData[m];
            if (!monthData) continue;
            const start = (m === startMonth) ? startDay : 0;
            const end = (m === endMonth) ? endDay : monthData.length - 1;

            for (let d = start; d <= end; d++) {
                if (monthData[d] !== undefined) {
                    totalPeriods += monthData[d];
                }
            }
        }
    }

    return totalPeriods;
};

export const findRequiredAttendanceDate = (
    currentAttended: number,
    currentTotal: number,
    checkFromDate: Date,
): Date | null => {
    const requiredPercentage = currentSettings.percentage / 100;
    if (currentTotal > 0 && (currentAttended / currentTotal) >= requiredPercentage) {
        return null;
    }
    
    let tempAttended = currentAttended;
    let tempTotal = currentTotal;

    for (let year = checkFromDate.getFullYear(); year <= checkFromDate.getFullYear() + 1; year++) { // Check current and next year
        const yearData = generateYearData(year);
        const startMonth = (year === checkFromDate.getFullYear()) ? checkFromDate.getMonth() : 0;

        for (let m = startMonth; m < 12; m++) {
            const monthData = yearData[m];
            if (!monthData) continue;
            const startDay = (year === checkFromDate.getFullYear() && m === checkFromDate.getMonth()) ? checkFromDate.getDate() : 1;

            for (let d = startDay; d <= monthData.length; d++) {
                const periodsToday = monthData[d - 1];
                if (periodsToday !== undefined) {
                    tempAttended += periodsToday;
                    tempTotal += periodsToday;
                }

                if (tempTotal > 0 && (tempAttended / tempTotal) >= requiredPercentage) {
                    return new Date(year, m, d);
                }
            }
        }
    }
    
    return null; // Cannot reach threshold
};
