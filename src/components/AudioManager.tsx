import React, { useEffect, useState } from "react";
import axios from "axios";
import Modal from "./modal/Modal";
import { UrlInput } from "./modal/UrlInput";
import AudioPlayer from "./AudioPlayer";
import { TranscribeButton } from "./TranscribeButton";
import Constants from "../utils/Constants";
import { Transcriber } from "../hooks/useTranscriber";
import Progress from "./Progress";
import AudioRecorder from "./AudioRecorder";

function titleCase(str: string) {
    str = str.toLowerCase();
    return (str.match(/\w+.?/g) || [])
        .map((word) => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join("");
}

// List of supported languages:
// https://help.openai.com/en/articles/7031512-whisper-api-faq
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
const LANGUAGES = {
    en: "english",
    sv: "swedish",
    pl: "polish",
    de: "german",
    /*zh: "chinese",
    es: "spanish/castilian",
    ru: "russian",
    ko: "korean",
    fr: "french",
    ja: "japanese",
    pt: "portuguese",
    tr: "turkish",
    ca: "catalan/valencian",
    nl: "dutch/flemish",
    ar: "arabic",
    it: "italian",
    id: "indonesian",
    hi: "hindi",
    fi: "finnish",
    vi: "vietnamese",
    he: "hebrew",
    uk: "ukrainian",
    el: "greek",
    ms: "malay",
    cs: "czech",
    ro: "romanian/moldavian/moldovan",
    da: "danish",
    hu: "hungarian",
    ta: "tamil",
    no: "norwegian",
    th: "thai",
    ur: "urdu",
    hr: "croatian",
    bg: "bulgarian",
    lt: "lithuanian",
    la: "latin",
    mi: "maori",
    ml: "malayalam",
    cy: "welsh",
    sk: "slovak",
    te: "telugu",
    fa: "persian",
    lv: "latvian",
    bn: "bengali",
    sr: "serbian",
    az: "azerbaijani",
    sl: "slovenian",
    kn: "kannada",
    et: "estonian",
    mk: "macedonian",
    br: "breton",
    eu: "basque",
    is: "icelandic",
    hy: "armenian",
    ne: "nepali",
    mn: "mongolian",
    bs: "bosnian",
    kk: "kazakh",
    sq: "albanian",
    sw: "swahili",
    gl: "galician",
    mr: "marathi",
    pa: "punjabi/panjabi",
    si: "sinhala/sinhalese",
    km: "khmer",
    sn: "shona",
    yo: "yoruba",
    so: "somali",
    af: "afrikaans",
    oc: "occitan",
    ka: "georgian",
    be: "belarusian",
    tg: "tajik",
    sd: "sindhi",
    gu: "gujarati",
    am: "amharic",
    yi: "yiddish",
    lo: "lao",
    uz: "uzbek",
    fo: "faroese",
    ht: "haitian creole/haitian",
    ps: "pashto/pushto",
    tk: "turkmen",
    nn: "nynorsk",
    mt: "maltese",
    sa: "sanskrit",
    lb: "luxembourgish/letzeburgesch",
    my: "myanmar/burmese",
    bo: "tibetan",
    tl: "tagalog",
    mg: "malagasy",
    as: "assamese",
    tt: "tatar",
    haw: "hawaiian",
    ln: "lingala",
    ha: "hausa",
    ba: "bashkir",
    jw: "javanese",
    su: "sundanese",*/
};

const MODELS = Object.entries({
    // Original checkpoints
    "KBLab/kb-whisper-large": 3009,
    "KBLab/kb-whisper-medium": 1500
    //"onnx-community/whisper-tiny": 120, // 33 + 87
    //"onnx-community/whisper-base": 206, // 83 + 123
    //"onnx-community/whisper-small": 586, // 353 + 233
    //"onnx-community/whisper-large-v3-turbo": 1604, // 1270 + 334

    // Distil Whisper (English-only)
    //"onnx-community/distil-small.en": 538, // 353 + 185
});

export enum AudioSource {
    URL = "URL",
    FILE = "FILE",
    RECORDING = "RECORDING",
}

export function AudioManager(props: { transcriber: Transcriber }) {
    const [progress, setProgress] = useState<number | undefined>(0);
    const [audioData, setAudioData] = useState<
        | {
              buffer: AudioBuffer;
              url: string;
              source: AudioSource;
              mimeType: string;
              name?: string;
          }
        | undefined
    >(undefined);

    const [audioDownloadUrl, setAudioDownloadUrl] = useState<
        string | undefined
    >(undefined);

    const [batch, setBatch] = useState<{
        decoded: AudioBuffer;
        blobUrl: string;
        mimeType: string;
        name: string;
        status: 'pending' | 'transcribing' | 'completed' | 'error';
        transcript?: string;
    }[]>([]);

    const [isBatchMode, setIsBatchMode] = useState(false);

    useEffect(() => {
        if (isBatchMode && !props.transcriber.isBusy) {
            const nextIndex = batch.findIndex(item => item.status === 'pending');
            if (nextIndex !== -1) {
                const nextItem = batch[nextIndex];
                setBatch(prev => prev.map((item, i) => i === nextIndex ? { ...item, status: 'transcribing' } : item));
                props.transcriber.start(nextItem.decoded, nextItem.name);
            } else {
                // Check if we just finished the last one
                const transcribingIndex = batch.findIndex(item => item.status === 'transcribing');
                if (transcribingIndex === -1 && batch.length > 0 && batch.every(item => item.status === 'completed')) {
                    // All done
                }
            }
        }
    }, [isBatchMode, batch, props.transcriber.isBusy]);

    useEffect(() => {
        if (isBatchMode && props.transcriber.output && !props.transcriber.isBusy) {
            const transcribingIndex = batch.findIndex(item => item.status === 'transcribing');
            if (transcribingIndex !== -1) {
                const currentItem = batch[transcribingIndex];
                // Check if the output name matches (or just assume since it's sequential)
                setBatch(prev => prev.map((item, i) => i === transcribingIndex ? {
                    ...item,
                    status: 'completed',
                    transcript: props.transcriber.output?.text
                } : item));
            }
        }
    }, [props.transcriber.output, props.transcriber.isBusy, isBatchMode]);

    const resetAudio = () => {
        setAudioData(undefined);
        setAudioDownloadUrl(undefined);
        setBatch([]);
        setIsBatchMode(false);
    };

    const setAudioFromDownload = async (
        data: ArrayBuffer,
        mimeType: string,
    ) => {
        const audioCTX = new AudioContext({
            sampleRate: Constants.SAMPLING_RATE,
        });
        const blobUrl = URL.createObjectURL(
            new Blob([data], { type: "audio/*" }),
        );
        const decoded = await audioCTX.decodeAudioData(data);
        setAudioData({
            buffer: decoded,
            url: blobUrl,
            source: AudioSource.URL,
            mimeType: mimeType,
        });
    };

    const setAudioFromRecording = async (data: Blob) => {
        resetAudio();
        setProgress(0);
        const blobUrl = URL.createObjectURL(data);
        const fileReader = new FileReader();
        fileReader.onprogress = (event) => {
            setProgress(event.loaded / event.total || 0);
        };
        fileReader.onloadend = async () => {
            const audioCTX = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });
            const arrayBuffer = fileReader.result as ArrayBuffer;
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            setProgress(undefined);
            setAudioData({
                buffer: decoded,
                url: blobUrl,
                source: AudioSource.RECORDING,
                mimeType: data.type,
            });
        };
        fileReader.readAsArrayBuffer(data);
    };

    const downloadAudioFromUrl = async (
        requestAbortController: AbortController,
    ) => {
        if (audioDownloadUrl) {
            try {
                setAudioData(undefined);
                setProgress(0);
                const { data, headers } = (await axios.get(audioDownloadUrl, {
                    signal: requestAbortController.signal,
                    responseType: "arraybuffer",
                    onDownloadProgress(progressEvent) {
                        setProgress(progressEvent.progress || 0);
                    },
                })) as {
                    data: ArrayBuffer;
                    headers: { "content-type": string };
                };

                let mimeType = headers["content-type"];
                if (!mimeType || mimeType === "audio/wave") {
                    mimeType = "audio/wav";
                }
                setAudioFromDownload(data, mimeType);
            } catch (error) {
                console.log("Request failed or aborted", error);
                setProgress(undefined);
            }
        }
    };

    // When URL changes, download audio
    useEffect(() => {
        if (audioDownloadUrl) {
            const requestAbortController = new AbortController();
            downloadAudioFromUrl(requestAbortController);
            return () => {
                requestAbortController.abort();
            };
        }
    }, [audioDownloadUrl]);

    return (
        <>
            <div className='flex flex-col justify-center items-center rounded-lg bg-white shadow-xl shadow-black/5 ring-1 ring-slate-700/10'>
                <div className='flex flex-row space-x-2 py-2 w-full px-2'>
                    <UrlTile
                        icon={<AnchorIcon />}
                        text={"From URL"}
                        onUrlUpdate={(e) => {
                            props.transcriber.onInputChange();
                            setAudioDownloadUrl(e);
                        }}
                    />
                    <VerticalBar />
                    <FileTile
                        icon={<FolderIcon />}
                        text={"From file(s)"}
                        onFilesUpdate={(files) => {
                            props.transcriber.onInputChange();
                            resetAudio();
                            if (files.length === 1) {
                                setAudioData({
                                    buffer: files[0].decoded,
                                    url: files[0].blobUrl,
                                    source: AudioSource.FILE,
                                    mimeType: files[0].mimeType,
                                    name: files[0].name,
                                });
                            } else if (files.length > 1) {
                                setBatch(files.map(f => ({
                                    ...f,
                                    status: 'pending'
                                })));
                                setIsBatchMode(true);
                            }
                        }}
                    />
                    {navigator.mediaDevices && (
                        <>
                            <VerticalBar />
                            <RecordTile
                                icon={<MicrophoneIcon />}
                                text={"Record"}
                                setAudioData={(e) => {
                                    props.transcriber.onInputChange();
                                    setAudioFromRecording(e);
                                }}
                            />
                        </>
                    )}
                </div>
                <AudioDataBar
                    progress={
                        progress !== undefined && audioData
                            ? 1
                            : (progress ?? 0)
                    }
                />
            </div>

            <SettingsTile
                className='flex bottom-4 right-4'
                transcriber={props.transcriber}
                icon={<SettingsIcon />}
            />

            <div className={'flex flex-col'}>
                <label className='text-sm mb-1'>Select the source language:</label>
                <div className='flex flex-col justify-left'>
                    <label className='inline-flex items-center'>
                        <input
                            type='radio'
                            value='swedish'
                            checked={props.transcriber.language === 'swedish'}
                            onChange={() => props.transcriber.setLanguage("swedish")}
                        />
                        <span className='ml-2'>Swedish</span>
                    </label>
                    <label className='inline-flex items-center'>
                        <input
                            type='radio'
                            value='english'
                            checked={props.transcriber.language === 'english'}
                            onChange={() => props.transcriber.setLanguage("english")}
                        />
                        <span className='ml-2'>English</span>
                    </label>
                    <label className='inline-flex items-center'>
                        <input
                            type='radio'
                            value='german'
                            checked={props.transcriber.language === 'german'}
                            onChange={() => props.transcriber.setLanguage("german")}
                        />
                        <span className='ml-2'>German</span>
                    </label>
                    <label className='inline-flex items-center'>
                        <input
                            type='radio'
                            value='polish'
                            checked={props.transcriber.language === 'polish'}
                            onChange={() => props.transcriber.setLanguage("polish")}
                        />
                        <span className='ml-2'>Polish</span>
                    </label>
                    {/* Add more languages as needed */}
                </div>

            </div>

            {isBatchMode && batch.length > 0 && (
                <div className='w-full mt-4 p-4 bg-white rounded-lg shadow-xl shadow-black/5 ring-1 ring-slate-700/10'>
                    <h3 className='text-lg font-semibold mb-2'>Batch Progress</h3>
                    <div className='space-y-2'>
                        {batch.map((item, index) => (
                            <div key={index} className='flex items-center justify-between p-2 border-b last:border-0'>
                                <div className='flex flex-col'>
                                    <span className='text-sm font-medium truncate max-w-xs'>{item.name}</span>
                                    <span className={`text-xs ${item.status === 'completed' ? 'text-green-500' : item.status === 'transcribing' ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {item.status.toUpperCase()}
                                    </span>
                                </div>
                                {item.status === 'completed' && (
                                    <div className='flex space-x-2'>
                                        <button
                                            onClick={() => {
                                                const blob = new Blob([item.transcript || ""], { type: "text/plain" });
                                                const url = URL.createObjectURL(blob);
                                                const link = document.createElement("a");
                                                link.href = url;
                                                link.download = item.name + ".txt";
                                                link.click();
                                                URL.revokeObjectURL(url);
                                            }}
                                            className='text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600'
                                        >
                                            Download TXT
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {!batch.every(item => item.status === 'completed' || item.status === 'error') && (
                        <div className='mt-4'>
                            <p className='text-sm text-gray-500'>
                                Transcribing {batch.filter(item => item.status === 'completed').length} / {batch.length} files...
                            </p>
                        </div>
                    )}
                </div>
            )}

            {audioData && (
                <>
                    <AudioPlayer
                        audioUrl={audioData.url}
                        mimeType={audioData.mimeType}
                    />

                    <div className='relative w-full flex justify-center items-center'>
                        <TranscribeButton
                            onClick={() => {
                                props.transcriber.start(audioData.buffer);
                            }}
                            isModelLoading={props.transcriber.isModelLoading}
                            isTranscribing={props.transcriber.isBusy}
                        />
                    </div>
                    {props.transcriber.progressItems.length > 0 && (
                        <div className='relative z-10 p-4 w-full text-center'>
                            <label>
                                Loading model files... (only run once)
                            </label>
                            {props.transcriber.progressItems.map((data) => (
                                <div key={data.file}>
                                    <Progress
                                        text={data.file}
                                        percentage={data.progress}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}


        </>
    );
}

function SettingsTile(props: {
    icon: JSX.Element;
    className?: string;
    transcriber: Transcriber;
}) {
    const [showModal, setShowModal] = useState(false);

    const onClick = () => {
        setShowModal(true);
    };

    const onClose = () => {
        setShowModal(false);
    };

    const onSubmit = () => {
        onClose();
    };

    return (
        <div className={props.className}>
            <Tile icon={props.icon} onClick={onClick} />
            <SettingsModal
                show={showModal}
                onSubmit={onSubmit}
                onClose={onClose}
                transcriber={props.transcriber}
            />
        </div>
    );
}

function SettingsModal(props: {
    show: boolean;
    onSubmit: (url: string) => void;
    onClose: () => void;
    transcriber: Transcriber;
}) {
    // @ts-ignore
    const names = Object.values(LANGUAGES).map(titleCase);

    const models = MODELS.filter(
        ([key, _value]) =>
            !props.transcriber.multilingual || !key.includes("/distil-"),
    ).map(([key, value]) => ({
        key,
        size: value,
        id: `${key}${props.transcriber.multilingual || key.includes("/distil-") ? "" : ".en"}`,
    }));
    return (
        <Modal
            show={props.show}
            title={"Settings"}
            content={
                <>
                    <label>Select the model to use.</label>
                    <select
                        className='mt-1 mb-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
                        value={props.transcriber.model}
                        onChange={(e) => {
                            props.transcriber.setModel(e.target.value);
                        }}
                    >
                        {models.map(({ key, id, size }) => (
                            <option
                                key={key}
                                value={id}
                            >{`${id} (${size}MB)`}</option>
                        ))}
                    </select>
                    <div className='flex justify-end items-center mb-3 px-1'>
                        <div className='flex'>
                            <input
                                id='multilingual'
                                type='checkbox'
                                checked={props.transcriber.multilingual}
                                onChange={(e) => {
                                    let model = Constants.DEFAULT_MODEL;
                                    if (!e.target.checked) {
                                        model += ".en";
                                    }
                                    props.transcriber.setModel(model);
                                    props.transcriber.setMultilingual(
                                        e.target.checked,
                                    );
                                }}
                            ></input>
                            <label htmlFor={"multilingual"} className='ms-1'>
                                Multilingual
                            </label>
                        </div>
                    </div>
                    {props.transcriber.multilingual && (
                        <>
                            {/*<label>Select the source language.</label>
                            <select
                                className='mt-1 mb-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
                                defaultValue={props.transcriber.language}
                                onChange={(e) => {

                                    props.transcriber.setLanguage(
                                        e.target.value,
                                    );
                                }}
                            >
                                {Object.keys(LANGUAGES).map((key, i) => (
                                    <option key={key} value={key}>
                                        {names[i]}
                                    </option>
                                ))}
                            </select>*/}
                            <label>Select the task to perform.</label>
                            <select
                                className='mt-1 mb-3 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500'
                                defaultValue={props.transcriber.subtask}
                                onChange={(e) => {
                                    props.transcriber.setSubtask(
                                        e.target.value,
                                    );
                                }}
                            >
                                <option value={"transcribe"}>Transcribe</option>
                                <option value={"translate"}>
                                    Translate (to English)
                                </option>
                            </select>
                        </>
                    )}
                </>
            }
            onClose={props.onClose}
            onSubmit={() => {}}
        />
    );
}

function VerticalBar() {
    return <div className='w-[1px] bg-slate-200'></div>;
}

function AudioDataBar(props: { progress: number }) {
    return <ProgressBar progress={`${Math.round(props.progress * 100)}%`} />;
}

function ProgressBar(props: { progress: string }) {
    return (
        <div className='w-full rounded-full h-1 bg-gray-200 dark:bg-gray-700'>
            <div
                className='bg-blue-600 h-1 rounded-full transition-all duration-100'
                style={{ width: props.progress }}
            ></div>
        </div>
    );
}

function UrlTile(props: {
    icon: JSX.Element;
    text: string;
    onUrlUpdate: (url: string) => void;
}) {
    const [showModal, setShowModal] = useState(false);

    const onClick = () => {
        setShowModal(true);
    };

    const onClose = () => {
        setShowModal(false);
    };

    const onSubmit = (url: string) => {
        props.onUrlUpdate(url);
        onClose();
    };

    return (
        <>
            <Tile icon={props.icon} text={props.text} onClick={onClick} />
            <UrlModal show={showModal} onSubmit={onSubmit} onClose={onClose} />
        </>
    );
}

function UrlModal(props: {
    show: boolean;
    onSubmit: (url: string) => void;
    onClose: () => void;
}) {
    const [url, setUrl] = useState(Constants.DEFAULT_AUDIO_URL);

    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(event.target.value);
    };

    const onSubmit = () => {
        props.onSubmit(url);
    };

    return (
        <Modal
            show={props.show}
            title={"From URL"}
            content={
                <>
                    {"Enter the URL of the audio file you want to load."}
                    <UrlInput onChange={onChange} value={url} />
                </>
            }
            onClose={props.onClose}
            submitText={"Load"}
            onSubmit={onSubmit}
        />
    );
}

function FileTile(props: {
    icon: JSX.Element;
    text: string;
    onFilesUpdate: (
        files: {
            decoded: AudioBuffer;
            blobUrl: string;
            mimeType: string;
            name: string;
        }[],
    ) => void;
}) {
    // Create hidden input element
    const elem = document.createElement("input");
    elem.type = "file";
    elem.multiple = true;
    elem.oninput = async (event) => {
        // Make sure we have files to use
        const files = (event.target as HTMLInputElement).files;
        if (!files) return;

        const results: {
            decoded: AudioBuffer;
            blobUrl: string;
            mimeType: string;
            name: string;
        }[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const urlObj = URL.createObjectURL(file);
            const mimeType = file.type;
            const name = file.name;

            const arrayBuffer = await file.arrayBuffer();
            const audioCTX = new AudioContext({
                sampleRate: Constants.SAMPLING_RATE,
            });
            const decoded = await audioCTX.decodeAudioData(arrayBuffer);
            results.push({ decoded, blobUrl: urlObj, mimeType, name });
        }

        props.onFilesUpdate(results);

        // Reset files
        elem.value = "";
    };

    return (
        <Tile
            icon={props.icon}
            text={props.text}
            onClick={() => elem.click()}
        />
    );
}

function RecordTile(props: {
    icon: JSX.Element;
    text: string;
    setAudioData: (data: Blob) => void;
}) {
    const [showModal, setShowModal] = useState(false);

    const onClick = () => {
        setShowModal(true);
    };

    const onClose = () => {
        setShowModal(false);
    };

    const onSubmit = (data: Blob | undefined) => {
        if (data) {
            props.setAudioData(data);
            onClose();
        }
    };

    return (
        <>
            <Tile icon={props.icon} text={props.text} onClick={onClick} />
            <RecordModal
                show={showModal}
                onSubmit={onSubmit}
                onProgress={(_data) => {}}
                onClose={onClose}
            />
        </>
    );
}

function RecordModal(props: {
    show: boolean;
    onProgress: (data: Blob | undefined) => void;
    onSubmit: (data: Blob | undefined) => void;
    onClose: () => void;
}) {
    const [audioBlob, setAudioBlob] = useState<Blob>();

    const onRecordingComplete = (blob: Blob) => {
        setAudioBlob(blob);
    };

    const onSubmit = () => {
        props.onSubmit(audioBlob);
        setAudioBlob(undefined);
    };

    const onClose = () => {
        props.onClose();
        setAudioBlob(undefined);
    };

    return (
        <Modal
            show={props.show}
            title={"From Recording"}
            content={
                <>
                    {"Record audio using your microphone"}
                    <AudioRecorder
                        onRecordingProgress={(blob) => {
                            props.onProgress(blob);
                        }}
                        onRecordingComplete={onRecordingComplete}
                    />
                </>
            }
            onClose={onClose}
            submitText={"Load"}
            submitEnabled={audioBlob !== undefined}
            onSubmit={onSubmit}
        />
    );
}

function Tile(props: {
    icon: JSX.Element;
    text?: string;
    onClick?: () => void;
}) {
    return (
        <button
            onClick={props.onClick}
            className='flex items-center justify-center rounded-lg p-2 bg-blue text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all duration-200'
        >
            <div className='w-7 h-7'>{props.icon}</div>
            {props.text && (
                <div className='ml-2 break-text text-center text-md w-30'>
                    {props.text}
                </div>
            )}
        </button>
    );
}

function AnchorIcon() {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth='1.5'
            stroke='currentColor'
        >
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244'
            />
        </svg>
    );
}

function FolderIcon() {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth='1.5'
            stroke='currentColor'
        >
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776'
            />
        </svg>
    );
}

function SettingsIcon() {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth='1.25'
            stroke='currentColor'
        >
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z'
            />
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
            />
        </svg>
    );
}

function MicrophoneIcon() {
    return (
        <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth={1.5}
            stroke='currentColor'
        >
            <path
                strokeLinecap='round'
                strokeLinejoin='round'
                d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z'
            />
        </svg>
    );
}
