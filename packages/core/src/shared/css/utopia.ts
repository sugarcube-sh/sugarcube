/*
 * calculateClamp, roundValue and checkWCAG are adapted from utopia-core 1.6.0
 * (https://github.com/trys/utopia-core), which credits checkWCAG's calculation to Maxwell Barvian,
 * creator of fluid.style (https://barvian.me), and carries this licence:
 *
 * ISC License
 *
 * Copyright (c) 2024 Trys Mudford
 *
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without
 * fee is hereby granted, provided that the above copyright notice and this permission notice appear
 * in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
 * SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
 * AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE
 * OF THIS SOFTWARE.
 */

function roundValue(n: number): number {
    return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export function calculateClamp({
    minSize,
    maxSize,
    minWidth,
    maxWidth,
}: {
    minSize: number;
    maxSize: number;
    minWidth: number;
    maxWidth: number;
}): string {
    const isNegative = minSize > maxSize;
    const min = isNegative ? maxSize : minSize;
    const max = isNegative ? minSize : maxSize;
    const divider = 16;
    const slope =
        (maxSize / divider - minSize / divider) / (maxWidth / divider - minWidth / divider);
    const intersection = -1 * (minWidth / divider) * slope + minSize / divider;
    return `clamp(${roundValue(min / divider)}rem, ${roundValue(intersection)}rem + ${roundValue(slope * 100)}vw, ${roundValue(max / divider)}rem)`;
}

export function checkWCAG({
    min,
    max,
    minWidth,
    maxWidth,
}: {
    min: number;
    max: number;
    minWidth: number;
    maxWidth: number;
}): [number, number] | undefined {
    if (minWidth > maxWidth) {
        [minWidth, maxWidth] = [maxWidth, minWidth];
        [min, max] = [max, min];
    }
    const slope = (max - min) / (maxWidth - minWidth);
    const intercept = min - minWidth * slope;
    const lh = (5 * min - 2 * intercept) / (2 * slope);
    const rh = (5 * intercept - 2 * max) / (-1 * slope);
    const lh2 = (3 * intercept) / slope;

    const failRange: number[] = [];
    if (maxWidth < 5 * minWidth) {
        if (minWidth < lh && lh < maxWidth) failRange.push(Math.max(lh, minWidth), maxWidth);
        if (5 * min < 2 * max) failRange.push(maxWidth, 5 * minWidth);
        if (5 * minWidth < rh && rh < 5 * maxWidth) {
            failRange.push(5 * minWidth, Math.min(rh, 5 * maxWidth));
        }
    } else {
        if (minWidth < lh && lh < 5 * minWidth)
            failRange.push(Math.max(lh, minWidth), 5 * minWidth);
        if (5 * minWidth < lh2 && lh2 < maxWidth)
            failRange.push(Math.max(lh2, 5 * minWidth), maxWidth);
        if (maxWidth < rh && rh < 5 * maxWidth)
            failRange.push(maxWidth, Math.min(rh, 5 * maxWidth));
    }

    const [from, to] = [failRange[0], failRange.at(-1)];
    if (from === undefined || to === undefined || Math.abs(to - from) < 0.1) return undefined;
    return [from, to];
}
