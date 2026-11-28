use qbsdiff::Bsdiff;
use std::env;
use std::fs::File;
use std::io::{BufWriter, Read};

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 4 {
        eprintln!("Usage: mkpatch <old.apk> <new.apk> <out.qbs>");
        std::process::exit(1);
    }

    let mut old_data = Vec::new();
    File::open(&args[1])
        .expect("open old apk")
        .read_to_end(&mut old_data)
        .expect("read old apk");

    let mut new_data = Vec::new();
    File::open(&args[2])
        .expect("open new apk")
        .read_to_end(&mut new_data)
        .expect("read new apk");

    let out = BufWriter::new(File::create(&args[3]).expect("create patch file"));
    let written = Bsdiff::new(&old_data, &new_data)
        .parallel_scheme(qbsdiff::ParallelScheme::Auto)
        .compare(out)
        .expect("compute bsdiff");

    println!(
        "Generated delta patch {} ({} bytes, {:.2}% of full APK)",
        args[3],
        written,
        (written as f64 / new_data.len().max(1) as f64) * 100.0
    );
}
