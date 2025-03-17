import { AudioManager } from "./components/AudioManager";
import Transcript from "./components/Transcript";
import { useTranscriber } from "./hooks/useTranscriber";

// @ts-ignore
const IS_WEBGPU_AVAILABLE = !!navigator.gpu;

function App() {
    const transcriber = useTranscriber();

    return IS_WEBGPU_AVAILABLE ? (
        <div className='flex flex-col justify-center items-center min-h-screen'>
            <div className='container flex flex-col justify-center items-center'>
                <img src="/logo.png" alt="logo" style={{ width: '50%' }} />
                <h1 className='text-5xl font-extrabold tracking-tight text-slate-900 sm:text-7xl text-center mt-4'>
                    CDHU Whisper
                </h1>

                <h2 className='mt-3 mb-5 px-4 text-center text-1xl font-semibold tracking-tight text-slate-900 sm:text-2xl'>
                    Click 'From file' and choose an audio file to transcribe.<br /> Click the cog on the bottom right corner to change models.
                </h2>

                <div className='text-center mt-4 max-w-3xl mx-auto'>
                    CDHU Whisper is a web application that <strong>runs locally</strong> in-browser, on your own computer. This means it is <strong>completely secure</strong> and that <strong>no data ever leaves your machine</strong>. While we will be developing this beta-version and adding features, it is meant as a <strong>limited stop-gap solution</strong> (self-served, self-supported) until a large scale university wide transcription-service is in place. Therefore, please note the following <strong>caveats/limitations</strong>:
                    <ul className='text-left list-disc pl-4 mt-4'><li>
                        Speed and performance <strong>will be limited by your particular computer.</strong> If transcriptions are slow or the model won't load, please switch to more powerful hardware (more RAM, better GPU). M1/M2 Macs will generally perform well (3-4 mins of processing for ~10 mins of audio), as well as any powerful Windows/Linux Laptop. Close down all other tabs/applications if needed.</li><li>There is <strong>no batch upload/queing in place (yet).</strong> You will need to upload each individual file, wait for the transcription to complete, and save the result. Then repeat for the next file.</li>
                        <li>This service <strong>does not provide diarization</strong> (speaker identification).</li>
                        <li>For more advanced service beyond what this application provides or larger scale transcriptions, please consider contacting Uppmax for a transcription project or apply for CDHU pilot support.<br /></li>
                    </ul>
                    We welcome any {" "}
                    <a
                        className='underline font-bold'
                        href='https://docs.google.com/spreadsheets/d/1exVpiAGPcBLxuW8TWPgSkpK_eMOMofCaS8kSB-ybbEE/edit?gid=0#gid=0'
                    >
                        feedback
                    </a>
                </div>
                <br />
                <div className={'flex flex-wrap gap-4 items-start justify-center'}>
                    <AudioManager transcriber={transcriber} />
                    <div className={'flex flex-col'}>
                        <label className='text-sm mb-1'>Select the source language:</label>
                        <div className='flex flex-col items-end'>
                            <label className='inline-flex items-center'>
                                <input
                                    type='radio'
                                    value='english'
                                    checked={transcriber.language === 'english'}
                                    onChange={() => transcriber.setLanguage("english")}
                                />
                                <span className='ml-2'>en</span>
                            </label>
                            <label className='inline-flex items-center'>
                                <input
                                    type='radio'
                                    value='swedish'
                                    checked={transcriber.language === 'swedish'}
                                    onChange={() => transcriber.setLanguage("swedish")}
                                />
                                <span className='ml-2'>se</span>
                            </label>
                            {/* Add more languages as needed */}
                        </div>

                    </div>
                    <Transcript transcribedData={transcriber.output} />
                </div>
            </div>



            {/*<div className='absolute bottom-4'>
                Uppsala University - {" "}
                <a
                    className='underline'
                    href='https://www.uu.se/en/centre/digital-humanities-and-social-sciences'
                >
                    CDHU
                </a>
            </div>*/}
        </div>
    ) : (
        <div className='fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center'>

            CDHU Whisper is not supported
            on this browser.
            <br />
            Please use Google Chrome.
            <img src="/logo.png" alt="logo" style={{ width: '25%' }} />
        </div>
    );
}

export default App;
