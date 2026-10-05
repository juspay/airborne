/// Run `load` once per chunk of `keys` and return all rows, in chunk order.
/// Keeps each query small (bind parameters, expression depth) however many
/// keys the caller has: a built Diesel query can't be split afterwards, so
/// the keys are split and the caller builds the query for each chunk.
pub fn load_in_chunks<K, T, E>(
    keys: &[K],
    chunk_size: usize,
    mut load: impl FnMut(&[K]) -> Result<Vec<T>, E>,
) -> Result<Vec<T>, E> {
    let mut rows = Vec::new();
    for chunk in keys.chunks(chunk_size.max(1)) {
        rows.extend(load(chunk)?);
    }
    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunks_cover_every_key_in_order() {
        let keys: Vec<u32> = (0..1201).collect();
        let mut chunk_sizes = Vec::new();
        let rows = load_in_chunks(&keys, 500, |chunk| {
            chunk_sizes.push(chunk.len());
            Ok::<_, ()>(chunk.to_vec())
        })
        .unwrap();
        assert_eq!(chunk_sizes, vec![500, 500, 201]);
        assert_eq!(rows, keys);
    }

    #[test]
    fn no_keys_run_no_query() {
        let mut calls = 0;
        let rows: Vec<u32> = load_in_chunks(&[] as &[u32], 500, |_| {
            calls += 1;
            Ok::<_, ()>(vec![])
        })
        .unwrap();
        assert!(rows.is_empty());
        assert_eq!(calls, 0);
    }

    #[test]
    fn first_error_stops_the_loop() {
        let keys: Vec<u32> = (0..10).collect();
        let mut calls = 0;
        let result = load_in_chunks(&keys, 3, |chunk| {
            calls += 1;
            if chunk[0] == 3 {
                Err("chunk 2 failed")
            } else {
                Ok(chunk.to_vec())
            }
        });
        assert_eq!(result, Err("chunk 2 failed"));
        assert_eq!(calls, 2);
    }

    #[test]
    fn zero_chunk_size_is_treated_as_one() {
        let keys = [1, 2, 3];
        let mut calls = 0;
        let rows = load_in_chunks(&keys, 0, |chunk| {
            calls += 1;
            Ok::<_, ()>(chunk.to_vec())
        })
        .unwrap();
        assert_eq!(rows, vec![1, 2, 3]);
        assert_eq!(calls, 3);
    }
}
