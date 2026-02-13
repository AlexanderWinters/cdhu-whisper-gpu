### Batch Upload and Transcription Implementation

This document describes the changes made to add batch upload and transcription functionality to the CDHU Whisper web application.

#### Changes Overview

1.  **Updated `useTranscriber` Hook**:
    *   Added support for tracking the name of the file being transcribed.
    *   Modified `TranscriberData` and `Transcriber` interfaces to include the file name.
    *   The `start` function now accepts an optional `name` parameter.

2.  **Updated `AudioManager` Component**:
    *   Modified `FileTile` to support multiple file selection (`multiple` attribute on the file input).
    *   Implemented a batch processing queue using `useState` and `useEffect`.
    *   Added logic to sequentially process files in the batch: when one transcription completes, the next pending file is automatically started.
    *   Added a "Batch Progress" UI section that displays the status of each file in the batch (Pending, Transcribing, Completed).
    *   Added individual "Download TXT" buttons for each completed file in the batch.

3.  **Updated `Transcript` Component**:
    *   Modified export functions (`exportTXT` and `exportJSON`) to use the specific file name instead of a generic "transcript" name.
    *   Passed the file name from the `transcriber.output` to ensure unique naming for each download.

4.  **Updated `App` Component**:
    *   Removed the warning about missing batch upload functionality.
    *   Ensured the file name is correctly passed to the `Transcript` component.

#### Unique File Naming

Each transcribed audio file now has a unique corresponding text file. When a file is uploaded, its original name (e.g., `interview1.mp3`) is tracked throughout the transcription process. When the user clicks "Download TXT" or uses the Export buttons, the resulting file is named after the original audio file (e.g., `interview1.mp3.txt`).

#### Batch Workflow

1.  Click "From file(s)" and select multiple audio files.
2.  The application automatically switches to batch mode.
3.  The first file begins transcribing immediately.
4.  The Batch Progress UI shows the status of all files.
5.  As each file completes, its status updates to "COMPLETED", its result is cached, and the next file starts.
6.  Users can download the results for any completed file at any time.

#### Technical Details

*   **Sequential Processing**: To avoid overloading the browser and GPU, transcriptions are processed one at a time. This is managed by a `useEffect` hook in `AudioManager` that watches the `isBusy` status of the transcriber.
*   **Unique Downloads**: Each item in the batch state stores its final transcript text, allowing for individual downloads even after the transcriber has moved on to the next file.
