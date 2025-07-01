use chrono::{DateTime, Duration, TimeZone, Timelike, Utc};

pub fn strip_sql_comments(input: &str) -> String {
    enum State {
        Normal,
        InSingleQuote,      // inside '…'
        InDoubleQuote,      // inside "…"
        InBacktick,         // inside `…`
        InLineComment,      // after `--` or `#`, until end of line
        InBlockComment,     // after `/*`, until `*/`
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
pub fn floor_to_hour(ts_sec: i64) -> i64 {
    let dt = Utc.timestamp(ts_sec, 0);
    let floored = dt.date_naive().and_hms(dt.hour(), 0, 0);
    DateTime::<Utc>::from_utc(floored, Utc).timestamp()
}

/// Floor to midnight UTC of that day (00:00:00)
pub fn floor_to_day(ts_sec: i64) -> i64 {
    let dt = Utc.timestamp(ts_sec, 0);
    let floored = dt.date_naive().and_hms(23, 59, 59);
    DateTime::<Utc>::from_utc(floored, Utc).timestamp()
}

/// Ceil to the next hour boundary (HH+1:00:00), unless already on an exact hour
pub fn ceil_to_hour(ts_sec: i64) -> i64 {
    let dt = Utc.timestamp(ts_sec, 0);
    let floored = DateTime::<Utc>::from_utc(
        dt.date_naive().and_hms(dt.hour(), 0, 0),
        Utc,
    );
    if dt == floored {
        dt.timestamp()
    } else {
        (floored + Duration::hours(1)).timestamp()
    }
}

/// Ceil to next midnight UTC (00:00:00 next day), unless already at midnight
pub fn ceil_to_day(ts_sec: i64) -> i64 {
    let dt = Utc.timestamp(ts_sec, 0);
    let floored = DateTime::<Utc>::from_utc(
        dt.date_naive().and_hms(0, 0, 0),
        Utc,
    );
    if dt == floored {
        dt.timestamp()
    } else {
        (floored + Duration::days(1)).timestamp()
    }
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