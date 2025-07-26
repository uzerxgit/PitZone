import { isAfter } from 'date-fns';

type YearData = number[][];

const yearData = ((): YearData => {
    const year: YearData = [];
    const periodCycle = [6, 7, 8, 7, 0, 6, 7];
    let cycleIndex = 0; 

    const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    for (let m = 0; m < 12; m++) {
        const month: number[] = [];
        for (let d = 0; d < monthLengths[m]; d++) {
            month.push(periodCycle[cycleIndex]);
            cycleIndex = (cycleIndex + 1) % 7;
        }
        year.push(month);
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
        if (year[monthIndex]) {
            holidays[monthIndex].forEach(dayIndex => {
                if (year[monthIndex][dayIndex] !== undefined) {
                    year[monthIndex][dayIndex] = 0;
                }
            });
        }
    }
    return year;
})();

export const calculatePeriodsInRange = (startDate: Date, endDate: Date): number => {
    if (isAfter(startDate, endDate)) return 0;

    let totalPeriods = 0;
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate() - 1;
    const endMonth = endDate.getMonth();
    const endDay = endDate.getDate() - 1;

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
    return totalPeriods;
};

export const findRequiredAttendanceDate = (
    currentAttended: number,
    currentTotal: number,
    checkFromDate: Date,
): Date | null => {
    if (currentTotal > 0 && (currentAttended / currentTotal) >= 0.75) {
        return null;
    }

    let tempAttended = currentAttended;
    let tempTotal = currentTotal;
    const currentYear = checkFromDate.getFullYear();

    for (let m = checkFromDate.getMonth(); m < 12; m++) {
        const monthData = yearData[m];
        if (!monthData) continue;
        const startDay = (m === checkFromDate.getMonth()) ? checkFromDate.getDate() : 1;

        for (let d = startDay; d <= monthData.length; d++) {
            const periodsToday = monthData[d - 1];
            if (periodsToday !== undefined) {
                tempAttended += periodsToday;
                tempTotal += periodsToday;
            }

            if (tempTotal > 0 && (tempAttended / tempTotal) >= 0.75) {
                return new Date(currentYear, m, d);
            }
        }
    }
    
    return null; // Cannot reach 75% within the year
};
