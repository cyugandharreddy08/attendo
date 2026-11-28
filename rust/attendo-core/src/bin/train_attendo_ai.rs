use attendo_core::attendo_ai::{
    backward_sample, tokenize, AttendoIntent, AttendoTransformer, NUM_INTENTS,
};
use std::fs;
use std::path::Path;

fn build_dataset() -> Vec<(String, usize)> {
    let subjects = [
        "os",
        "operating systems",
        "dbms",
        "database management",
        "math",
        "calculus",
        "physics",
        "chemistry",
        "dsa",
        "data structures",
        "algorithms",
        "cn",
        "computer networks",
        "ai",
        "machine learning",
        "english",
        "yoga",
        "microprocessors",
        "compiler design",
        "software engineering",
    ];
    let days = [
        "today",
        "tomorrow",
        "yesterday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    let rooms = ["lh1", "lh2", "room 302", "lab 4", "auditorium", "c201"];
    let times = ["9am", "10:00", "11:30", "2pm", "14:00", "4pm"];

    let mut data: Vec<(String, usize)> = Vec::new();

    // 0: GetAttendanceSummary
    for p in [
        "what is my attendance",
        "show attendance summary",
        "how is my attendance looking",
        "am i safe or in danger",
        "how many classes can i bunk",
        "show safe bunks left",
        "check my overall percentage",
        "show theory and lab attendance",
        "am i above 75 percent",
        "which subjects are below 75",
        "attendance report please",
        "status of all subjects",
        "bunk status",
        "check attendance",
        "how many hours do i need to attend",
    ] {
        data.push((p.into(), AttendoIntent::GetAttendanceSummary as usize));
    }
    for s in subjects {
        data.push((
            format!("what is my {} attendance", s),
            AttendoIntent::GetAttendanceSummary as usize,
        ));
        data.push((
            format!("how many {} classes can i bunk", s),
            AttendoIntent::GetAttendanceSummary as usize,
        ));
        data.push((
            format!("am i safe in {}", s),
            AttendoIntent::GetAttendanceSummary as usize,
        ));
    }

    // 1: GetSchedule
    for d in days {
        data.push((
            format!("what classes do i have {}", d),
            AttendoIntent::GetSchedule as usize,
        ));
        data.push((
            format!("show {} schedule", d),
            AttendoIntent::GetSchedule as usize,
        ));
        data.push((
            format!("{} timetable", d),
            AttendoIntent::GetSchedule as usize,
        ));
        data.push((
            format!("list lectures for {}", d),
            AttendoIntent::GetSchedule as usize,
        ));
    }
    for p in [
        "show my timetable",
        "full weekly schedule",
        "do i have class right now",
        "next class",
        "todays classes",
    ] {
        data.push((p.into(), AttendoIntent::GetSchedule as usize));
    }

    // 2: FindFreeSlots
    for d in days {
        data.push((
            format!("when am i free {}", d),
            AttendoIntent::FindFreeSlots as usize,
        ));
        data.push((
            format!("find free slots on {}", d),
            AttendoIntent::FindFreeSlots as usize,
        ));
        data.push((
            format!("leisure slots {}", d),
            AttendoIntent::FindFreeSlots as usize,
        ));
        data.push((
            format!("any gaps in {} schedule", d),
            AttendoIntent::FindFreeSlots as usize,
        ));
    }

    // 3: MarkAttendance
    for s in subjects {
        for d in ["today", "yesterday", "monday", "friday"] {
            for st in ["present", "absent", "holiday", "cancelled"] {
                data.push((
                    format!("mark {} {} as {}", d, s, st),
                    AttendoIntent::MarkAttendance as usize,
                ));
                data.push((
                    format!("mark {} {} {}", s, st, d),
                    AttendoIntent::MarkAttendance as usize,
                ));
            }
            data.push((
                format!("i attended {} {}", s, d),
                AttendoIntent::MarkAttendance as usize,
            ));
            data.push((
                format!("i bunked {} {}", s, d),
                AttendoIntent::MarkAttendance as usize,
            ));
            data.push((
                format!("i missed {} {}", s, d),
                AttendoIntent::MarkAttendance as usize,
            ));
            data.push((
                format!("{} was cancelled {}", s, d),
                AttendoIntent::MarkAttendance as usize,
            ));
        }
    }
    for d in ["today", "yesterday", "tomorrow", "monday"] {
        for st in ["present", "absent", "holiday", "cancelled"] {
            data.push((
                format!("mark all classes {} {}", d, st),
                AttendoIntent::MarkAttendance as usize,
            ));
            data.push((
                format!("mark entire day {} as {}", d, st),
                AttendoIntent::MarkAttendance as usize,
            ));
        }
        data.push((
            format!("{} is a holiday", d),
            AttendoIntent::MarkAttendance as usize,
        ));
    }

    // 4: AddSubject
    for s in subjects {
        data.push((
            format!("add subject {}", s),
            AttendoIntent::AddSubject as usize,
        ));
        data.push((
            format!("create new subject {} theory 4 credits", s),
            AttendoIntent::AddSubject as usize,
        ));
        data.push((
            format!("add {} lab target 80 percent", s),
            AttendoIntent::AddSubject as usize,
        ));
        data.push((
            format!("new course {} with 3 credits", s),
            AttendoIntent::AddSubject as usize,
        ));
    }

    // 5: UpdateSubject
    for s in subjects {
        data.push((
            format!("change {} target to 80 percent", s),
            AttendoIntent::UpdateSubject as usize,
        ));
        data.push((
            format!("update {} target 85%", s),
            AttendoIntent::UpdateSubject as usize,
        ));
        data.push((
            format!("freeze subject {}", s),
            AttendoIntent::UpdateSubject as usize,
        ));
        data.push((
            format!("unfreeze {}", s),
            AttendoIntent::UpdateSubject as usize,
        ));
        data.push((
            format!("set {} credits to 4", s),
            AttendoIntent::UpdateSubject as usize,
        ));
        data.push((
            format!("edit subject {} past attended 10 out of 12", s),
            AttendoIntent::UpdateSubject as usize,
        ));
    }

    // 6: DeleteSubject
    for s in subjects {
        data.push((
            format!("delete subject {}", s),
            AttendoIntent::DeleteSubject as usize,
        ));
        data.push((
            format!("remove {} from my subjects", s),
            AttendoIntent::DeleteSubject as usize,
        ));
        data.push((
            format!("drop course {}", s),
            AttendoIntent::DeleteSubject as usize,
        ));
    }

    // 7: AddTimetableSlot
    for s in subjects.iter().take(10) {
        for d in ["monday", "tuesday", "wednesday", "thursday", "friday"] {
            let r = rooms[d.len() % rooms.len()];
            let t = times[s.len() % times.len()];
            data.push((
                format!("add {} class on {} at {} in {}", s, d, t, r),
                AttendoIntent::AddTimetableSlot as usize,
            ));
            data.push((
                format!("schedule {} every {} from 10:00 to 11:00", s, d),
                AttendoIntent::AddTimetableSlot as usize,
            ));
        }
    }

    // 8: DeleteTimetableSlot
    for s in subjects.iter().take(10) {
        for d in ["monday", "tuesday", "wednesday", "thursday", "friday"] {
            data.push((
                format!("delete {} timetable slot on {}", s, d),
                AttendoIntent::DeleteTimetableSlot as usize,
            ));
            data.push((
                format!("remove {} class from {} schedule", s, d),
                AttendoIntent::DeleteTimetableSlot as usize,
            ));
        }
    }

    // 9: ShiftClass
    for s in subjects.iter().take(10) {
        data.push((
            format!("shift today {} to tomorrow 2pm", s),
            AttendoIntent::ShiftClass as usize,
        ));
        data.push((
            format!("reschedule {} from monday to friday 11:00", s),
            AttendoIntent::ShiftClass as usize,
        ));
        data.push((
            format!("move {} class to wednesday 3pm", s),
            AttendoIntent::ShiftClass as usize,
        ));
    }

    // 10: UnshiftClass
    for s in subjects.iter().take(10) {
        data.push((
            format!("unshift {} class", s),
            AttendoIntent::UnshiftClass as usize,
        ));
        data.push((
            format!("revert shifted {} back to original slot", s),
            AttendoIntent::UnshiftClass as usize,
        ));
    }
    for p in [
        "unshift today class",
        "undo class shift",
        "restore original slot for shifted class",
    ] {
        data.push((p.into(), AttendoIntent::UnshiftClass as usize));
    }

    // 11: SimulateBunk
    for d in ["today", "tomorrow", "friday", "monday"] {
        data.push((
            format!("what happens if i bunk {}", d),
            AttendoIntent::SimulateBunk as usize,
        ));
        data.push((
            format!("simulate skipping {} classes", d),
            AttendoIntent::SimulateBunk as usize,
        ));
    }
    for s in subjects.iter().take(10) {
        data.push((
            format!("what if i bunk 2 classes of {}", s),
            AttendoIntent::SimulateBunk as usize,
        ));
        data.push((
            format!("impact of skipping {} tomorrow", s),
            AttendoIntent::SimulateBunk as usize,
        ));
    }

    // 12: FuturePlan
    for p in [
        "classes run till may 20 how many can i skip",
        "semester ends on 2026-12-20 plan my bunks",
        "future attendance plan till june 15",
        "how many days can i bunk till next month",
        "calculate future plan till end of semester",
        "if classes go on until december 10",
    ] {
        data.push((p.into(), AttendoIntent::FuturePlan as usize));
    }

    // 13: AddTodo
    for s in subjects.iter().take(8) {
        data.push((
            format!("add task submit {} assignment tomorrow", s),
            AttendoIntent::AddTodo as usize,
        ));
        data.push((
            format!("remind me to study {} quiz high priority", s),
            AttendoIntent::AddTodo as usize,
        ));
        data.push((
            format!("add todo prepare {} lab record", s),
            AttendoIntent::AddTodo as usize,
        ));
    }

    // 14: ToggleTodo
    for p in [
        "mark assignment task done",
        "complete todo submit lab record",
        "finish quiz task",
        "check off todo",
        "toggle task done",
        "i completed the assignment todo",
    ] {
        data.push((p.into(), AttendoIntent::ToggleTodo as usize));
    }

    // 15: DeleteTodo
    for p in [
        "delete todo assignment",
        "remove task lab record",
        "delete reminder",
        "clear task",
    ] {
        data.push((p.into(), AttendoIntent::DeleteTodo as usize));
    }

    // 16: RecoverDeleted (Critical user requirement!)
    for s in subjects {
        data.push((
            format!("i accidentally deleted {} recover it", s),
            AttendoIntent::RecoverDeleted as usize,
        ));
        data.push((
            format!("restore deleted {} from database", s),
            AttendoIntent::RecoverDeleted as usize,
        ));
        data.push((
            format!("help i mistakenly removed {} bring it back", s),
            AttendoIntent::RecoverDeleted as usize,
        ));
        data.push((
            format!("recover my deleted {} class", s),
            AttendoIntent::RecoverDeleted as usize,
        ));
    }
    for p in [
        "i deleted some classes by mistake help me recover them",
        "restore my deleted subject",
        "fetch deleted classes from database",
        "recover deleted data",
        "i mistakenly deleted my class please restore",
        "bring back deleted timetable slot",
        "recover deleted todo task",
        "undelete last removed subject",
    ] {
        data.push((p.into(), AttendoIntent::RecoverDeleted as usize));
    }

    // 17: ListDeleted
    for p in [
        "show deleted classes",
        "what did i delete recently",
        "list deleted subjects in database",
        "open recovery vault",
        "show trash or deleted items",
        "check deleted history",
    ] {
        data.push((p.into(), AttendoIntent::ListDeleted as usize));
    }

    // 18: UndoLastAction
    for p in [
        "undo last action",
        "oops undo that",
        "revert last attendance edit",
        "undo last mark",
        "cancel what i just marked",
        "take back last change",
    ] {
        data.push((p.into(), AttendoIntent::UndoLastAction as usize));
    }

    // 19: AppSystemAction
    for p in [
        "change global target attendance to 80%",
        "set target percentage to 85",
        "backup my data to cloud",
        "sync to cloud now",
        "check for app update",
        "hello",
        "hi proxy",
        "help what can you do",
        "how do i use attendo ai",
    ] {
        data.push((p.into(), AttendoIntent::AppSystemAction as usize));
    }

    data
}

fn main() {
    let dataset = build_dataset();
    println!("Dataset size: {} examples across {} intents", dataset.len(), NUM_INTENTS);

    // Deterministic shuffle
    let mut indices: Vec<usize> = (0..dataset.len()).collect();
    let mut rng = 0x9e3779b97f4a7c15u64;
    for i in (1..indices.len()).rev() {
        rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
        let j = (rng as usize) % (i + 1);
        indices.swap(i, j);
    }

    let split = (dataset.len() * 9) / 10;
    let train_idx = &indices[..split];
    let val_idx = &indices[split..];

    let mut model = AttendoTransformer::new_random(42);
    let param_shapes: Vec<usize> = model.param_vecs().iter().map(|v| v.len()).collect();
    let mut m: Vec<Vec<f32>> = param_shapes.iter().map(|&n| vec![0.0; n]).collect();
    let mut v: Vec<Vec<f32>> = param_shapes.iter().map(|&n| vec![0.0; n]).collect();
    let mut grads: Vec<Vec<f32>> = param_shapes.iter().map(|&n| vec![0.0; n]).collect();

    let epochs = 18;
    let batch_size = 32;
    let base_lr = 0.0045f32;
    let beta1 = 0.9f32;
    let beta2 = 0.999f32;
    let eps = 1e-8f32;
    let weight_decay = 1e-4f32;
    let mut step = 0i32;

    for epoch in 1..=epochs {
        let mut epoch_loss = 0.0f32;
        let mut train_correct = 0usize;

        // Reshuffle train_idx each epoch
        let mut epoch_order = train_idx.to_vec();
        for i in (1..epoch_order.len()).rev() {
            rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
            let j = (rng as usize) % (i + 1);
            epoch_order.swap(i, j);
        }

        let lr = base_lr * (0.5 * (1.0 + (std::f32::consts::PI * epoch as f32 / epochs as f32).cos())).max(0.15);

        for chunk in epoch_order.chunks(batch_size) {
            for g in grads.iter_mut() {
                g.fill(0.0);
            }
            for &idx in chunk {
                let (ref text, label) = dataset[idx];
                let toks = tokenize(text);
                let cache = model.forward(&toks);
                let pred = cache
                    .probs
                    .iter()
                    .enumerate()
                    .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                if pred == label {
                    train_correct += 1;
                }
                epoch_loss += backward_sample(&model, &cache, label, &mut grads);
            }

            step += 1;
            let inv_bs = 1.0 / chunk.len() as f32;
            let bc1 = 1.0 - beta1.powi(step);
            let bc2 = 1.0 - beta2.powi(step);

            let mut p_vecs = model.param_vecs_mut();
            for (p_i, p) in p_vecs.iter_mut().enumerate() {
                for j in 0..p.len() {
                    let g = (grads[p_i][j] * inv_bs).clamp(-2.0, 2.0) + weight_decay * p[j];
                    m[p_i][j] = beta1 * m[p_i][j] + (1.0 - beta1) * g;
                    v[p_i][j] = beta2 * v[p_i][j] + (1.0 - beta2) * g * g;
                    let m_hat = m[p_i][j] / bc1;
                    let v_hat = v[p_i][j] / bc2;
                    p[j] -= lr * m_hat / (v_hat.sqrt() + eps);
                }
            }
        }

        let mut val_correct = 0usize;
        for &idx in val_idx {
            let (ref text, label) = dataset[idx];
            let (pred, _, _) = model.predict(text);
            if pred as usize == label {
                val_correct += 1;
            }
        }

        println!(
            "Epoch {:2}/{} | Loss: {:.4} | Train Acc: {:.2}% | Val Acc: {:.2}%",
            epoch,
            epochs,
            epoch_loss / train_idx.len() as f32,
            100.0 * train_correct as f32 / train_idx.len() as f32,
            100.0 * val_correct as f32 / val_idx.len() as f32
        );
    }

    let out_dir = Path::new("attendo-core/assets");
    fs::create_dir_all(out_dir).expect("create assets dir");
    let out_path = out_dir.join("attendo_ai_weights.bin");
    let bytes = model.to_bytes();
    fs::write(&out_path, &bytes).expect("write weights");
    println!(
        "Saved trained pure-Rust Transformer weights to {} ({} bytes / {:.2} KB)",
        out_path.display(),
        bytes.len(),
        bytes.len() as f32 / 1024.0
    );
}
