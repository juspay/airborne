use diesel::deserialize::{self, FromSql};
use diesel::expression::AsExpression;
use diesel::pg::Pg;
use diesel::serialize::{self, Output, ToSql};
use diesel::sql_types::Text;
use diesel::FromSqlRow;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::str::FromStr;

#[derive(Debug, Clone, PartialEq, Eq, AsExpression, FromSqlRow)]
#[diesel(sql_type = Text)]
pub struct SemVer {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl SemVer {
    pub fn new(major: u32, minor: u32, patch: u32) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }
}

impl Default for SemVer {
    fn default() -> Self {
        Self {
            major: 1,
            minor: 0,
            patch: 1,
        }
    }
}

impl FromStr for SemVer {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.split('.').collect::<Vec<_>>().as_slice() {
            [major_str, minor_str, patch_str] => {
                let major = (*major_str)
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid major version: {}", major_str))?;
                let minor = (*minor_str)
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid minor version: {}", minor_str))?;
                let patch = (*patch_str)
                    .parse::<u32>()
                    .map_err(|_| format!("Invalid patch version: {}", patch_str))?;
                Ok(Self::new(major, minor, patch))
            }
            _ => Err(format!("Invalid semver format: {}", s)),
        }
    }
}

impl std::fmt::Display for SemVer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

impl PartialOrd for SemVer {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for SemVer {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.major
            .cmp(&other.major)
            .then(self.minor.cmp(&other.minor))
            .then(self.patch.cmp(&other.patch))
    }
}

impl FromSql<Text, Pg> for SemVer {
    fn from_sql(bytes: diesel::pg::PgValue) -> deserialize::Result<Self> {
        let text = <String as FromSql<Text, Pg>>::from_sql(bytes)?;
        Self::from_str(&text).map_err(|e| e.into())
    }
}

impl ToSql<Text, Pg> for SemVer {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        let s = self.to_string();
        <String as ToSql<Text, Pg>>::to_sql(&s, &mut out.reborrow())
    }
}

impl Serialize for SemVer {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for SemVer {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::from_str(&s).map_err(serde::de::Error::custom)
    }
}
