use chrono::{TimeZone, Timelike, Utc};

pub fn strip_sql_comments(input: &str) -> String {
    enum State {
        Normal,
        InSingleQuote,  // inside '…'
        InDoubleQuote,  // inside "…"
        InBacktick,     // inside `…`
        InLineComment,  // after `--` or `#`, until end of line
        InBlockComment, // after `/*`, until `*/`
    }

    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();
    let mut state = State::Normal;

    while let Some(ch) = chars.next() {
        match state {
            State::Normal => {
                match ch {
                    '\'' => {
                        // Enter single‐quote string
                        out.push(ch);
                        state = State::InSingleQuote;
                    }
                    '"' => {
                        // Enter double‐quote string
                        out.push(ch);
                        state = State::InDoubleQuote;
                    }
                    '`' => {
                        // Enter backtick‐quoted identifier
                        out.push(ch);
                        state = State::InBacktick;
                    }
                    '-' => {
                        // Could be start of `--` comment
                        if let Some('-') = chars.peek() {
                            // consume second '-'
                            chars.next();
                            state = State::InLineComment;
                        } else {
                            out.push(ch);
                        }
                    }
                    '#' => {
                        // Start of single‐line comment
                        state = State::InLineComment;
                    }
                    '/' => {
                        // Could be start of block comment `/*`
                        if let Some('*') = chars.peek() {
                            chars.next();
                            state = State::InBlockComment;
                        } else {
                            out.push(ch);
                        }
                    }
                    _ => {
                        out.push(ch);
                    }
                }
            }

            State::InSingleQuote => {
                out.push(ch);
                if ch == '\\' {
                    // escape next character (so we don't accidentally see ' as closing)
                    if let Some(next_ch) = chars.next() {
                        out.push(next_ch);
                    }
                } else if ch == '\'' {
                    // end of single‐quote string
                    state = State::Normal;
                }
            }

            State::InDoubleQuote => {
                out.push(ch);
                if ch == '\\' {
                    // escape next character
                    if let Some(next_ch) = chars.next() {
                        out.push(next_ch);
                    }
                } else if ch == '"' {
                    // end of double‐quote string
                    state = State::Normal;
                }
            }

            State::InBacktick => {
                out.push(ch);
                if ch == '`' {
                    // end of backtick‐quoted identifier
                    state = State::Normal;
                }
            }

            State::InLineComment => {
                // consume until newline (but preserve the newline, since it might separate statements)
                if ch == '\n' {
                    out.push('\n');
                    state = State::Normal;
                } else {
                    // drop this character (skipped)
                }
            }

            State::InBlockComment => {
                // look for closing `*/`
                if ch == '*' {
                    if let Some('/') = chars.peek() {
                        // consume closing '/'
                        chars.next();
                        state = State::Normal;
                    }
                }
                // otherwise drop everything inside block comment, including newlines.
            }
        }
    }

    out
}

/// Floor to the start of the hour (HH:00:00)
pub fn try_into_hour(ts_sec: i64) -> Option<i64> {
    let dt = Utc.timestamp_opt(ts_sec, 0).single()?;
    let floored_ndt = dt.date_naive().and_hms_opt(dt.hour(), 0, 0)?;
    Some(Utc.from_utc_datetime(&floored_ndt).timestamp())
}

/// Floor to midnight UTC of that day (00:00:00)
pub fn try_into_date_end(ts_sec: i64) -> Option<i64> {
    let dt = Utc.timestamp_opt(ts_sec, 0).single()?;
    let ceiled_ndt = dt.date_naive().and_hms_opt(23, 59, 59)?;
    Some(Utc.from_utc_datetime(&ceiled_ndt).timestamp())
}

/// Ceil to the next hour boundary (HH+1:00:00), unless already on an exact hour
#[allow(dead_code)]
pub fn try_ceil_hour(ts_sec: i64) -> Option<i64> {
    let dt = Utc.timestamp_opt(ts_sec, 0).single()?;
    let needs_ceil = dt.minute() != 0 || dt.second() != 0;

    let ceiled = if needs_ceil {
        dt.date_naive().and_hms_opt(dt.hour() + 1, 0, 0)?.and_utc()
    } else {
        dt
    };

    Some(ceiled.timestamp())
}

/// Ceil to next midnight UTC (00:00:00 next day), unless already at midnight
#[allow(dead_code)]
pub fn try_ceil_date(ts_sec: i64) -> Option<i64> {
    let dt = Utc.timestamp_opt(ts_sec, 0).single()?;
    let is_midnight = dt.hour() == 0 && dt.minute() == 0 && dt.second() == 0;

    let next = if is_midnight {
        dt
    } else {
        dt.date_naive()
            .succ_opt()? // move to next day
            .and_hms_opt(0, 0, 0)?
            .and_utc()
    };

    Some(next.timestamp())
}

/// Normalize a Unix timestamp to seconds.
///
/// If `ts` looks like milliseconds (i.e. > 10⁹⁹), this will divide by 1_000.
/// Otherwise it returns `ts` unchanged.
pub fn normalize_to_secs(ts: i64) -> i64 {
    // Any timestamp > 10_000_000_000 is almost certainly in milliseconds
    // since current Unix time in seconds is around 1.8e9 (10 digits).
    const MILLIS_THRESHOLD: i64 = 10_000_000_000;

    if ts.abs() > MILLIS_THRESHOLD {
        ts / 1_000
    } else {
        ts
    }
}
