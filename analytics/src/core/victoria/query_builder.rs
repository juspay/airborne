/// A builder for PromQL queries against VictoriaMetrics.
#[derive(Debug, Clone)]
pub struct VictoriaQuery {
    metric_name: String,
    operation: String,
    labels: Vec<(String, String)>,
    time_bucket: String,
    group_by: Option<String>,
    group_by_labels: Option<Vec<String>>,
    children: Vec<VictoriaQuery>,
}

impl VictoriaQuery {
    /// Start a new query builder.
    pub fn new() -> Self {
        VictoriaQuery {
            metric_name: String::new(),
            operation: String::new(),
            labels: Vec::new(),
            time_bucket: String::new(),
            group_by: None,
            group_by_labels: None,
            children: Vec::new(),
        }
    }

    /// Set the metric name for a leaf selector.
    pub fn metric_name(mut self, name: impl Into<String>) -> Self {
        self.metric_name = name.into();
        self
    }

    /// Apply a function (e.g. "increase", "rate").
    pub fn operation(mut self, op: impl Into<String>) -> Self {
        self.operation = op.into();
        self
    }

    /// Add label matchers.
    pub fn labels(mut self, lbls: Vec<(String, String)>) -> Self {
        self.labels = lbls;
        self
    }

    /// Set the time window for range functions.
    pub fn time_bucket(mut self, bucket: impl Into<String>) -> Self {
        self.time_bucket = bucket.into();
        self
    }

    /// Set an aggregator (e.g. "sum", "avg").
    pub fn group_by(mut self, agg: impl Into<String>) -> Self {
        self.group_by = Some(agg.into());
        self
    }

    /// Specify labels for the aggregator.
    pub fn group_by_labels(mut self, lbls: Vec<impl Into<String>>) -> Self {
        self.group_by_labels = Some(lbls.into_iter().map(Into::into).collect());
        self
    }

    /// Add a nested child query.
    pub fn child(mut self, child: VictoriaQuery) -> Self {
        self.children.push(child);
        self
    }

    /// Build the final PromQL query string.
    pub fn build(&self) -> String {
        // 1. Base: either child or metric selector
        let base = if let Some(first) = self.children.get(0) {
            first.build()
        } else {
            let mut sel = self.metric_name.clone();
            if !self.labels.is_empty() {
                let lbl_text = self
                    .labels
                    .iter()
                    .map(|(k, v)| format!(r#"{}="{}""#, k, v))
                    .collect::<Vec<_>>()
                    .join(",");
                sel = format!("{}{{{}}}", sel, lbl_text);
            }
            sel
        };

        // 2. Operation wrap
        let with_op = if !self.operation.is_empty() {
            if !self.time_bucket.is_empty() {
                format!("{}({}[{}])", self.operation, base, self.time_bucket)
            } else {
                format!("{}({})", self.operation, base)
            }
        } else {
            base
        };

        // 3. Aggregation
        if let Some(ref agg) = self.group_by {
            let lbls = self
                .group_by_labels
                .as_ref()
                .map(|v| v.join(","))
                .unwrap_or_default();
            format!("{} by ({}) ({})", agg, lbls, with_op)
        } else {
            with_op
        }
    }
}
