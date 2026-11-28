use std::f32::consts::PI;

pub const VOCAB_SIZE: usize = 2048;
pub const MAX_SEQ_LEN: usize = 28;
pub const D_MODEL: usize = 64;
pub const N_HEADS: usize = 4;
pub const HEAD_DIM: usize = D_MODEL / N_HEADS; // 16
pub const D_FF: usize = 128;
pub const NUM_INTENTS: usize = 20;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(usize)]
pub enum AttendoIntent {
    GetAttendanceSummary = 0,
    GetSchedule = 1,
    FindFreeSlots = 2,
    MarkAttendance = 3,
    AddSubject = 4,
    UpdateSubject = 5,
    DeleteSubject = 6,
    AddTimetableSlot = 7,
    DeleteTimetableSlot = 8,
    ShiftClass = 9,
    UnshiftClass = 10,
    SimulateBunk = 11,
    FuturePlan = 12,
    AddTodo = 13,
    ToggleTodo = 14,
    DeleteTodo = 15,
    RecoverDeleted = 16,
    ListDeleted = 17,
    UndoLastAction = 18,
    AppSystemAction = 19,
}

impl AttendoIntent {
    pub fn from_index(idx: usize) -> Self {
        match idx {
            0 => Self::GetAttendanceSummary,
            1 => Self::GetSchedule,
            2 => Self::FindFreeSlots,
            3 => Self::MarkAttendance,
            4 => Self::AddSubject,
            5 => Self::UpdateSubject,
            6 => Self::DeleteSubject,
            7 => Self::AddTimetableSlot,
            8 => Self::DeleteTimetableSlot,
            9 => Self::ShiftClass,
            10 => Self::UnshiftClass,
            11 => Self::SimulateBunk,
            12 => Self::FuturePlan,
            13 => Self::AddTodo,
            14 => Self::ToggleTodo,
            15 => Self::DeleteTodo,
            16 => Self::RecoverDeleted,
            17 => Self::ListDeleted,
            18 => Self::UndoLastAction,
            _ => Self::AppSystemAction,
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::GetAttendanceSummary => "get_attendance_summary",
            Self::GetSchedule => "get_schedule",
            Self::FindFreeSlots => "find_free_slots",
            Self::MarkAttendance => "mark_attendance",
            Self::AddSubject => "add_subject",
            Self::UpdateSubject => "update_subject",
            Self::DeleteSubject => "delete_subject",
            Self::AddTimetableSlot => "add_timetable_slot",
            Self::DeleteTimetableSlot => "delete_timetable_slot",
            Self::ShiftClass => "shift_class",
            Self::UnshiftClass => "unshift_class",
            Self::SimulateBunk => "simulate_bunk",
            Self::FuturePlan => "future_plan",
            Self::AddTodo => "add_todo",
            Self::ToggleTodo => "toggle_todo",
            Self::DeleteTodo => "delete_todo",
            Self::RecoverDeleted => "recover_deleted",
            Self::ListDeleted => "list_deleted",
            Self::UndoLastAction => "undo_last_action",
            Self::AppSystemAction => "app_system_action",
        }
    }
}

/// Deterministic FNV-1a hash for subword & word-ngram tokenization
fn fnv1a_hash(bytes: &[u8]) -> usize {
    let mut hash: u64 = 0xcbf29ce484222325;
    for &b in bytes {
        hash ^= b as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    (hash as usize) % VOCAB_SIZE
}

/// Tokenizes prompt into word tokens + character trigrams (clamped to MAX_SEQ_LEN)
pub fn tokenize(text: &str) -> Vec<usize> {
    let clean: String = text
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '%' { c } else { ' ' })
        .collect();

    let words: Vec<&str> = clean.split_whitespace().collect();
    let mut tokens = Vec::with_capacity(MAX_SEQ_LEN);

    for (i, w) in words.iter().enumerate() {
        if tokens.len() >= MAX_SEQ_LEN {
            break;
        }
        tokens.push(fnv1a_hash(w.as_bytes()));

        // Word bigram
        if i + 1 < words.len() && tokens.len() < MAX_SEQ_LEN {
            let bigram = format!("{}_{}", w, words[i + 1]);
            tokens.push(fnv1a_hash(bigram.as_bytes()));
        }

        // Character 3-grams for typo tolerance
        let bytes = w.as_bytes();
        if bytes.len() >= 4 {
            for win in bytes.windows(3).take(2) {
                if tokens.len() >= MAX_SEQ_LEN {
                    break;
                }
                tokens.push(fnv1a_hash(win));
            }
        }
    }

    if tokens.is_empty() {
        tokens.push(0);
    }
    tokens
}

#[inline]
fn gelu(x: f32) -> f32 {
    0.5 * x * (1.0 + ((2.0 / PI).sqrt() * (x + 0.044715 * x * x * x)).tanh())
}

#[inline]
fn gelu_grad(x: f32) -> f32 {
    let k = (2.0 / PI).sqrt();
    let inner = k * (x + 0.044715 * x * x * x);
    let t = inner.tanh();
    let sech2 = 1.0 - t * t;
    let d_inner = k * (1.0 + 3.0 * 0.044715 * x * x);
    0.5 * (1.0 + t) + 0.5 * x * sech2 * d_inner
}

fn softmax_inplace(slice: &mut [f32]) {
    let max = slice.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let mut sum = 0.0f32;
    for v in slice.iter_mut() {
        *v = (*v - max).exp();
        sum += *v;
    }
    let inv = 1.0 / sum.max(1e-9);
    for v in slice.iter_mut() {
        *v *= inv;
    }
}

/// Pure-Rust Transformer Intent & Command Classifier
#[derive(Clone)]
pub struct AttendoTransformer {
    pub emb: Vec<f32>,      // [VOCAB_SIZE * D_MODEL]
    pub pos: Vec<f32>,      // [MAX_SEQ_LEN * D_MODEL]
    pub w_q: Vec<f32>,      // [D_MODEL * D_MODEL]
    pub w_k: Vec<f32>,      // [D_MODEL * D_MODEL]
    pub w_v: Vec<f32>,      // [D_MODEL * D_MODEL]
    pub w_o: Vec<f32>,      // [D_MODEL * D_MODEL]
    pub ln1_g: Vec<f32>,    // [D_MODEL]
    pub ln1_b: Vec<f32>,    // [D_MODEL]
    pub w1: Vec<f32>,       // [D_MODEL * D_FF]
    pub b1: Vec<f32>,       // [D_FF]
    pub w2: Vec<f32>,       // [D_FF * D_MODEL]
    pub b2: Vec<f32>,       // [D_MODEL]
    pub ln2_g: Vec<f32>,    // [D_MODEL]
    pub ln2_b: Vec<f32>,    // [D_MODEL]
    pub w_cls: Vec<f32>,    // [D_MODEL * NUM_INTENTS]
    pub b_cls: Vec<f32>,    // [NUM_INTENTS]
}

pub struct ForwardCache {
    pub tokens: Vec<usize>,
    pub x0: Vec<f32>,       // [T * D_MODEL]
    pub q: Vec<f32>,        // [T * D_MODEL]
    pub k: Vec<f32>,        // [T * D_MODEL]
    pub v: Vec<f32>,        // [T * D_MODEL]
    pub attn: Vec<f32>,     // [N_HEADS * T * T]
    pub attn_out: Vec<f32>, // [T * D_MODEL]
    pub res1: Vec<f32>,     // [T * D_MODEL]
    pub ln1: Vec<f32>,      // [T * D_MODEL]
    pub ln1_inv_std: Vec<f32>,
    pub ff1_pre: Vec<f32>,  // [T * D_FF]
    pub ff1: Vec<f32>,      // [T * D_FF]
    pub res2: Vec<f32>,     // [T * D_MODEL]
    pub ln2: Vec<f32>,      // [T * D_MODEL]
    pub ln2_inv_std: Vec<f32>,
    pub pooled: Vec<f32>,   // [D_MODEL]
    pub probs: Vec<f32>,    // [NUM_INTENTS]
}

impl AttendoTransformer {
    pub fn new_random(seed: u64) -> Self {
        let mut s = seed;
        let mut next_rand = || -> f32 {
            s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let u = ((s >> 33) as f32) / (u32::MAX as f32);
            u * 2.0 - 1.0
        };
        let mut init_mat = |len: usize, fan_in: usize| -> Vec<f32> {
            let scale = (2.0 / fan_in as f32).sqrt() * 0.5;
            (0..len).map(|_| next_rand() * scale).collect()
        };

        Self {
            emb: init_mat(VOCAB_SIZE * D_MODEL, D_MODEL),
            pos: init_mat(MAX_SEQ_LEN * D_MODEL, D_MODEL),
            w_q: init_mat(D_MODEL * D_MODEL, D_MODEL),
            w_k: init_mat(D_MODEL * D_MODEL, D_MODEL),
            w_v: init_mat(D_MODEL * D_MODEL, D_MODEL),
            w_o: init_mat(D_MODEL * D_MODEL, D_MODEL),
            ln1_g: vec![1.0; D_MODEL],
            ln1_b: vec![0.0; D_MODEL],
            w1: init_mat(D_MODEL * D_FF, D_MODEL),
            b1: vec![0.0; D_FF],
            w2: init_mat(D_FF * D_MODEL, D_FF),
            b2: vec![0.0; D_MODEL],
            ln2_g: vec![1.0; D_MODEL],
            ln2_b: vec![0.0; D_MODEL],
            w_cls: init_mat(D_MODEL * NUM_INTENTS, D_MODEL),
            b_cls: vec![0.0; NUM_INTENTS],
        }
    }

    pub fn forward(&self, tokens: &[usize]) -> ForwardCache {
        let t_len = tokens.len().min(MAX_SEQ_LEN).max(1);
        let mut x0 = vec![0.0f32; t_len * D_MODEL];
        for (t, &tok) in tokens.iter().take(t_len).enumerate() {
            let e_off = (tok % VOCAB_SIZE) * D_MODEL;
            let p_off = t * D_MODEL;
            for d in 0..D_MODEL {
                x0[p_off + d] = self.emb[e_off + d] + self.pos[p_off + d];
            }
        }

        // Q, K, V projections
        let q = matmul(&x0, &self.w_q, t_len, D_MODEL, D_MODEL);
        let k = matmul(&x0, &self.w_k, t_len, D_MODEL, D_MODEL);
        let v = matmul(&x0, &self.w_v, t_len, D_MODEL, D_MODEL);

        // Multi-head self-attention
        let mut attn = vec![0.0f32; N_HEADS * t_len * t_len];
        let mut ctx = vec![0.0f32; t_len * D_MODEL];
        let scale = 1.0 / (HEAD_DIM as f32).sqrt();

        for h in 0..N_HEADS {
            let h_off = h * HEAD_DIM;
            for i in 0..t_len {
                let a_row = (h * t_len + i) * t_len;
                for j in 0..t_len {
                    let mut dot = 0.0f32;
                    for d in 0..HEAD_DIM {
                        dot += q[i * D_MODEL + h_off + d] * k[j * D_MODEL + h_off + d];
                    }
                    attn[a_row + j] = dot * scale;
                }
                softmax_inplace(&mut attn[a_row..a_row + t_len]);
                for j in 0..t_len {
                    let w = attn[a_row + j];
                    for d in 0..HEAD_DIM {
                        ctx[i * D_MODEL + h_off + d] += w * v[j * D_MODEL + h_off + d];
                    }
                }
            }
        }

        let attn_out = matmul(&ctx, &self.w_o, t_len, D_MODEL, D_MODEL);
        let mut res1 = vec![0.0f32; t_len * D_MODEL];
        for i in 0..res1.len() {
            res1[i] = x0[i] + attn_out[i];
        }
        let (ln1, ln1_inv_std) = layernorm(&res1, &self.ln1_g, &self.ln1_b, t_len, D_MODEL);

        // Feed-forward
        let mut ff1_pre = matmul(&ln1, &self.w1, t_len, D_MODEL, D_FF);
        for t in 0..t_len {
            for d in 0..D_FF {
                ff1_pre[t * D_FF + d] += self.b1[d];
            }
        }
        let ff1: Vec<f32> = ff1_pre.iter().map(|&x| gelu(x)).collect();
        let mut ff2 = matmul(&ff1, &self.w2, t_len, D_FF, D_MODEL);
        for t in 0..t_len {
            for d in 0..D_MODEL {
                ff2[t * D_MODEL + d] += self.b2[d];
            }
        }

        let mut res2 = vec![0.0f32; t_len * D_MODEL];
        for i in 0..res2.len() {
            res2[i] = ln1[i] + ff2[i];
        }
        let (ln2, ln2_inv_std) = layernorm(&res2, &self.ln2_g, &self.ln2_b, t_len, D_MODEL);

        // Mean pool over sequence
        let mut pooled = vec![0.0f32; D_MODEL];
        let inv_t = 1.0 / t_len as f32;
        for t in 0..t_len {
            for d in 0..D_MODEL {
                pooled[d] += ln2[t * D_MODEL + d] * inv_t;
            }
        }

        let mut logits = matmul(&pooled, &self.w_cls, 1, D_MODEL, NUM_INTENTS);
        for c in 0..NUM_INTENTS {
            logits[c] += self.b_cls[c];
        }
        let mut probs = logits;
        softmax_inplace(&mut probs);

        ForwardCache {
            tokens: tokens.iter().take(t_len).cloned().collect(),
            x0,
            q,
            k,
            v,
            attn,
            attn_out,
            res1,
            ln1,
            ln1_inv_std,
            ff1_pre,
            ff1,
            res2,
            ln2,
            ln2_inv_std,
            pooled,
            probs,
        }
    }

    pub fn predict(&self, prompt: &str) -> (AttendoIntent, f32, Vec<(AttendoIntent, f32)>) {
        let tokens = tokenize(prompt);
        let cache = self.forward(&tokens);
        let mut ranked: Vec<(AttendoIntent, f32)> = cache
            .probs
            .iter()
            .enumerate()
            .map(|(i, &p)| (AttendoIntent::from_index(i), p))
            .collect();
        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let (best_intent, conf) = ranked[0];
        (best_intent, conf, ranked)
    }

    pub fn param_vecs_mut(&mut self) -> Vec<&mut Vec<f32>> {
        vec![
            &mut self.emb,
            &mut self.pos,
            &mut self.w_q,
            &mut self.w_k,
            &mut self.w_v,
            &mut self.w_o,
            &mut self.ln1_g,
            &mut self.ln1_b,
            &mut self.w1,
            &mut self.b1,
            &mut self.w2,
            &mut self.b2,
            &mut self.ln2_g,
            &mut self.ln2_b,
            &mut self.w_cls,
            &mut self.b_cls,
        ]
    }

    pub fn param_vecs(&self) -> Vec<&Vec<f32>> {
        vec![
            &self.emb,
            &self.pos,
            &self.w_q,
            &self.w_k,
            &self.w_v,
            &self.w_o,
            &self.ln1_g,
            &self.ln1_b,
            &self.w1,
            &self.b1,
            &self.w2,
            &self.b2,
            &self.ln2_g,
            &self.ln2_b,
            &self.w_cls,
            &self.b_cls,
        ]
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(750_000);
        out.extend_from_slice(b"ATND_AI1");
        for vec in self.param_vecs() {
            let len = vec.len() as u32;
            out.extend_from_slice(&len.to_le_bytes());
            for &f in vec {
                out.extend_from_slice(&f.to_le_bytes());
            }
        }
        out
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.len() < 8 || &bytes[0..8] != b"ATND_AI1" {
            return Err("Invalid ATND_AI1 model weights header".into());
        }
        let mut cursor = 8usize;
        let mut read_vec = |expected: usize| -> Result<Vec<f32>, String> {
            if cursor + 4 > bytes.len() {
                return Err("Truncated model tensor length".into());
            }
            let len = u32::from_le_bytes(bytes[cursor..cursor + 4].try_into().unwrap()) as usize;
            cursor += 4;
            if len != expected || cursor + len * 4 > bytes.len() {
                return Err(format!("Tensor size mismatch: got {}, expected {}", len, expected));
            }
            let mut v = Vec::with_capacity(len);
            for _ in 0..len {
                let f = f32::from_le_bytes(bytes[cursor..cursor + 4].try_into().unwrap());
                cursor += 4;
                v.push(f);
            }
            Ok(v)
        };

        Ok(Self {
            emb: read_vec(VOCAB_SIZE * D_MODEL)?,
            pos: read_vec(MAX_SEQ_LEN * D_MODEL)?,
            w_q: read_vec(D_MODEL * D_MODEL)?,
            w_k: read_vec(D_MODEL * D_MODEL)?,
            w_v: read_vec(D_MODEL * D_MODEL)?,
            w_o: read_vec(D_MODEL * D_MODEL)?,
            ln1_g: read_vec(D_MODEL)?,
            ln1_b: read_vec(D_MODEL)?,
            w1: read_vec(D_MODEL * D_FF)?,
            b1: read_vec(D_FF)?,
            w2: read_vec(D_FF * D_MODEL)?,
            b2: read_vec(D_MODEL)?,
            ln2_g: read_vec(D_MODEL)?,
            ln2_b: read_vec(D_MODEL)?,
            w_cls: read_vec(D_MODEL * NUM_INTENTS)?,
            b_cls: read_vec(NUM_INTENTS)?,
        })
    }
}

/// Backward pass accumulating gradients into `grads` (same layout as `param_vecs`)
pub fn backward_sample(
    model: &AttendoTransformer,
    cache: &ForwardCache,
    target_intent: usize,
    grads: &mut [Vec<f32>],
) -> f32 {
    let t_len = cache.tokens.len();
    let loss = -cache.probs[target_intent].max(1e-7).ln();

    // d_logits = probs - one_hot
    let mut d_logits = cache.probs.clone();
    d_logits[target_intent] -= 1.0;

    // Classifier head grads: w_cls [D_MODEL x NUM_INTENTS], b_cls [NUM_INTENTS]
    let mut d_pooled = vec![0.0f32; D_MODEL];
    for c in 0..NUM_INTENTS {
        grads[15][c] += d_logits[c];
        for d in 0..D_MODEL {
            grads[14][d * NUM_INTENTS + c] += cache.pooled[d] * d_logits[c];
            d_pooled[d] += model.w_cls[d * NUM_INTENTS + c] * d_logits[c];
        }
    }

    // Mean pool backward
    let inv_t = 1.0 / t_len as f32;
    let mut d_ln2 = vec![0.0f32; t_len * D_MODEL];
    for t in 0..t_len {
        for d in 0..D_MODEL {
            d_ln2[t * D_MODEL + d] = d_pooled[d] * inv_t;
        }
    }

    // LayerNorm2 backward (approximate gamma/beta + pass-through)
    let mut d_res2 = vec![0.0f32; t_len * D_MODEL];
    {
        let (g_head, g_tail) = grads.split_at_mut(13);
        layernorm_backward(
            &cache.res2,
            &cache.ln2,
            &cache.ln2_inv_std,
            &model.ln2_g,
            &d_ln2,
            &mut d_res2,
            &mut g_head[12],
            &mut g_tail[0],
            t_len,
            D_MODEL,
        );
    }

    // res2 = ln1 + ff2
    let mut d_ln1 = d_res2.clone();
    let mut d_ff1 = vec![0.0f32; t_len * D_FF];
    for t in 0..t_len {
        for d in 0..D_MODEL {
            let g = d_res2[t * D_MODEL + d];
            grads[11][d] += g;
            for f in 0..D_FF {
                grads[10][f * D_MODEL + d] += cache.ff1[t * D_FF + f] * g;
                d_ff1[t * D_FF + f] += model.w2[f * D_MODEL + d] * g;
            }
        }
    }

    // GELU + W1 backward
    for t in 0..t_len {
        for f in 0..D_FF {
            let dg = d_ff1[t * D_FF + f] * gelu_grad(cache.ff1_pre[t * D_FF + f]);
            grads[9][f] += dg;
            for d in 0..D_MODEL {
                grads[8][d * D_FF + f] += cache.ln1[t * D_MODEL + d] * dg;
                d_ln1[t * D_MODEL + d] += model.w1[d * D_FF + f] * dg;
            }
        }
    }

    // LayerNorm1 backward
    let mut d_res1 = vec![0.0f32; t_len * D_MODEL];
    {
        let (g_head, g_tail) = grads.split_at_mut(7);
        layernorm_backward(
            &cache.res1,
            &cache.ln1,
            &cache.ln1_inv_std,
            &model.ln1_g,
            &d_ln1,
            &mut d_res1,
            &mut g_head[6],
            &mut g_tail[0],
            t_len,
            D_MODEL,
        );
    }

    // res1 = x0 + attn_out (direct residual + W_o + V path)
    let mut d_x0 = d_res1.clone();
    // Reconstruct ctx from attn * v
    let mut ctx = vec![0.0f32; t_len * D_MODEL];
    for h in 0..N_HEADS {
        let h_off = h * HEAD_DIM;
        for i in 0..t_len {
            let a_row = (h * t_len + i) * t_len;
            for j in 0..t_len {
                let w = cache.attn[a_row + j];
                for d in 0..HEAD_DIM {
                    ctx[i * D_MODEL + h_off + d] += w * cache.v[j * D_MODEL + h_off + d];
                }
            }
        }
    }

    let mut d_ctx = vec![0.0f32; t_len * D_MODEL];
    for t in 0..t_len {
        for d_out in 0..D_MODEL {
            let g = d_res1[t * D_MODEL + d_out];
            for d_in in 0..D_MODEL {
                grads[5][d_in * D_MODEL + d_out] += ctx[t * D_MODEL + d_in] * g;
                d_ctx[t * D_MODEL + d_in] += model.w_o[d_in * D_MODEL + d_out] * g;
            }
        }
    }

    // Backprop through attention weights -> V, Q, K
    let mut d_v = vec![0.0f32; t_len * D_MODEL];
    let mut d_q = vec![0.0f32; t_len * D_MODEL];
    let mut d_k = vec![0.0f32; t_len * D_MODEL];
    let scale = 1.0 / (HEAD_DIM as f32).sqrt();

    for h in 0..N_HEADS {
        let h_off = h * HEAD_DIM;
        for i in 0..t_len {
            let a_row = (h * t_len + i) * t_len;
            let mut d_attn = vec![0.0f32; t_len];
            for j in 0..t_len {
                let w = cache.attn[a_row + j];
                let mut dot = 0.0f32;
                for d in 0..HEAD_DIM {
                    let dc = d_ctx[i * D_MODEL + h_off + d];
                    d_v[j * D_MODEL + h_off + d] += w * dc;
                    dot += dc * cache.v[j * D_MODEL + h_off + d];
                }
                d_attn[j] = dot;
            }
            // Softmax Jacobian
            let sum_wa: f32 = (0..t_len).map(|j| cache.attn[a_row + j] * d_attn[j]).sum();
            for j in 0..t_len {
                let ds = cache.attn[a_row + j] * (d_attn[j] - sum_wa) * scale;
                for d in 0..HEAD_DIM {
                    d_q[i * D_MODEL + h_off + d] += ds * cache.k[j * D_MODEL + h_off + d];
                    d_k[j * D_MODEL + h_off + d] += ds * cache.q[i * D_MODEL + h_off + d];
                }
            }
        }
    }

    for t in 0..t_len {
        for d_out in 0..D_MODEL {
            let gq = d_q[t * D_MODEL + d_out];
            let gk = d_k[t * D_MODEL + d_out];
            let gv = d_v[t * D_MODEL + d_out];
            for d_in in 0..D_MODEL {
                let x = cache.x0[t * D_MODEL + d_in];
                grads[2][d_in * D_MODEL + d_out] += x * gq;
                grads[3][d_in * D_MODEL + d_out] += x * gk;
                grads[4][d_in * D_MODEL + d_out] += x * gv;
                d_x0[t * D_MODEL + d_in] +=
                    model.w_q[d_in * D_MODEL + d_out] * gq
                        + model.w_k[d_in * D_MODEL + d_out] * gk
                        + model.w_v[d_in * D_MODEL + d_out] * gv;
            }
        }
    }

    // Embeddings & positional embeddings
    for (t, &tok) in cache.tokens.iter().enumerate() {
        let e_off = (tok % VOCAB_SIZE) * D_MODEL;
        let p_off = t * D_MODEL;
        for d in 0..D_MODEL {
            let g = d_x0[p_off + d];
            grads[0][e_off + d] += g;
            grads[1][p_off + d] += g;
        }
    }

    loss
}

fn matmul(a: &[f32], b: &[f32], m: usize, k: usize, n: usize) -> Vec<f32> {
    let mut c = vec![0.0f32; m * n];
    for i in 0..m {
        for p in 0..k {
            let av = a[i * k + p];
            let b_row = p * n;
            let c_row = i * n;
            for j in 0..n {
                c[c_row + j] += av * b[b_row + j];
            }
        }
    }
    c
}

fn layernorm(x: &[f32], g: &[f32], b: &[f32], t_len: usize, d_model: usize) -> (Vec<f32>, Vec<f32>) {
    let mut out = vec![0.0f32; t_len * d_model];
    let mut inv_stds = vec![0.0f32; t_len];
    for t in 0..t_len {
        let off = t * d_model;
        let mean: f32 = x[off..off + d_model].iter().sum::<f32>() / d_model as f32;
        let var: f32 = x[off..off + d_model]
            .iter()
            .map(|v| {
                let d = v - mean;
                d * d
            })
            .sum::<f32>()
            / d_model as f32;
        let inv_std = 1.0 / (var + 1e-5).sqrt();
        inv_stds[t] = inv_std;
        for d in 0..d_model {
            out[off + d] = ((x[off + d] - mean) * inv_std) * g[d] + b[d];
        }
    }
    (out, inv_stds)
}

fn layernorm_backward(
    _x: &[f32],
    y_norm_scaled: &[f32],
    inv_stds: &[f32],
    g: &[f32],
    dy: &[f32],
    dx: &mut [f32],
    dg: &mut [f32],
    db: &mut [f32],
    t_len: usize,
    d_model: usize,
) {
    for t in 0..t_len {
        let off = t * d_model;
        let inv_s = inv_stds[t];
        let mut sum_dyg = 0.0f32;
        for d in 0..d_model {
            db[d] += dy[off + d];
            let x_hat = (y_norm_scaled[off + d]) / g[d].max(1e-5);
            dg[d] += dy[off + d] * x_hat;
            sum_dyg += dy[off + d] * g[d];
        }
        let mean_dyg = sum_dyg / d_model as f32;
        for d in 0..d_model {
            dx[off + d] += (dy[off + d] * g[d] - mean_dyg) * inv_s;
        }
    }
}

/// Embedded pre-trained weights compiled directly into libattendo_core.so
static EMBEDDED_WEIGHTS: &[u8] = include_bytes!("../assets/attendo_ai_weights.bin");

pub fn load_embedded_model() -> Result<AttendoTransformer, String> {
    AttendoTransformer::from_bytes(EMBEDDED_WEIGHTS)
}
