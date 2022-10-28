import {Slider} from "@mui/material";
import {formatDuration} from "./util";

export function NowDoing(props) {
    const mixes = props.mix
    const idx = props.current
    const mix = mixes && idx !== undefined ? mixes[idx] : undefined;
    if (mix) {
        const at = props.at
        const duration = mix.programEndAtMs - mix.programStartAtMs;
        const exerciseAt = at - mix.programStartAtMs;
        let bpm = Math.round(mix.bpm, 0);
        if (!mix.bpm) {
            let i = idx;
            for ( ; i >= 0; i--) {
                if (mixes[i].bpm) {
                    bpm = Math.round(mixes[i].bpm, 0);
                    break;
                }
            }
        }
        return (
            <div className={'main'}>
                <h1>{mix.exercise} {formatDuration(duration)} @ {mix.intensity}% <span>({bpm} BPM)</span></h1>
                <Slider
                    max={mix.programEndAtMs}
                    min={mix.programStartAtMs}
                    value={at}
                    size={'small'}
                />
                <div className={'times'}>
                    <div className={'at'}>{formatDuration(exerciseAt)} </div>
                    <div className={'of'}>{formatDuration(duration)} </div>
                </div>
            </div>
        )
    } else {
        return (
            <div><h1>Nothing is playing</h1></div>
        )
    }
}