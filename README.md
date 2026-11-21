# biometric-auth--Fingerprint-Recognition--
# Fingerprint Recognition — CYSE 304

## Project information

**Course:** CYSE 304 — Biometric Authentication  
**Topic:** Fingerprint Recognition  
**Group members:**
- Wasan Bader Al Sarmi — 2316232
- Mariah Khalifa Al Zakwani — 2316218

Suggested repository name (add your group number if your instructor requires one):
`biometric-auth-fingerprint-recognition-group<number>`

## Project overview

This is a browser-based fingerprint matching and verification demonstration. The application is implemented in **HTML, CSS, and JavaScript** in a single standalone file (`index.html`). Python is not required.

The demo illustrates the fingerprint-processing workflow, including ridge enhancement, binarisation, skeletonisation, minutiae extraction (ridge endings and bifurcations), alignment, matching, and a threshold-based ACCEPT / REJECT decision.

It supports one-to-one (1:1) verification:
- Enroll a reference fingerprint.
- Select a probe fingerprint.
- Calculate a matching score.
- Compare the score with the selected threshold.
- **Score ≥ threshold:** ACCEPT
- **Score < threshold:** REJECT

The page includes synthetic sample fingerprints for demonstration and allows users to add fingerprint image files. The built-in samples are synthetic, not scans of real people.

## Technologies

- HTML5
- CSS3
- JavaScript
- Browser Canvas API

No Python installation, package manager, or `requirements.txt` is needed.

## How to run

1. Download or clone this repository.
2. Open `index.html` in a modern web browser (such as Chrome, Edge, or Firefox).
3. The application runs locally in the browser. No server or installation is normally required.
4. Use the built-in synthetic sample library, or add fingerprint image files using the upload control in the page.

If the browser blocks a feature when opening the file directly, run a simple local server from the repository folder:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. This optional command uses Python only as a basic static web server; **the project implementation itself is not written in Python**.

## Demo workflow

1. Choose a sample fingerprint and enroll it.
2. Choose another fingerprint as the verification probe.
3. Observe the processing stages and extracted minutiae.
4. Review the matching score and matched minutiae.
5. Adjust the decision threshold and observe whether the result is ACCEPT or REJECT.
6. Try a genuine pair (two impressions of the same synthetic finger) and an impostor pair (different synthetic fingers).
7. If demonstrating uploaded images, use permitted sample images and explain their source.

The application also provides an evaluation view that compares sample pairs and illustrates the relationship between the threshold, False Acceptance Rate (FAR), and False Rejection Rate (FRR). Treat these results as a demonstration of the included sample set and algorithm, not as a claim of production-level accuracy.

## Dataset and sample images

The application contains built-in **synthetic** fingerprint samples. It also provides an option to add image files; the page notes that FVC2000 / FVC2002 samples can be used after converting TIFF images to PNG.

If you add external fingerprint images to this repository, record:
- the official dataset/source URL,
- the applicable license or usage terms,
- any required attribution,
- whether redistribution is permitted.

Do not publish private biometric data or real people's fingerprint images without appropriate permission. Do not claim that synthetic samples are real biometric captures.

## Screenshots

Add genuine screenshots of the running `index.html` application to this folder. Useful screenshots include:
- the application showing its enrollment and verification workflow,
- the minutiae extraction or matching visualization,
- an ACCEPT result,
- a REJECT result,
- the evaluation view showing FAR / FRR at a selected threshold.

Use screenshots captured from your actual demo; do not use mock results.

## Limitations and security note

This is an educational demonstration, not a production biometric authentication system. Its scores and FAR / FRR depend on the included algorithm, sample set, image quality, and threshold. The built-in data is synthetic, so results from it cannot establish real-world biometric accuracy. The demo should not be used to protect real accounts or sensitive systems.

## References and attribution

- Course handout: **CYSE 304 — Biometric Authentication Group Project Instructions**.
- The presentation is included in `slides/`.
