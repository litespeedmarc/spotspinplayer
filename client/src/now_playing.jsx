import {useState} from "react";
import {Slider} from "@mui/material";
import {formatDuration} from "./util";

export function NowPlaying() {

    const [state, setState] = useState(undefined);

    function updateStatus() {
        if (!window.player) {
            setState(undefined);
            return;
        }
        window.player.getCurrentState().then( (state) => {
            setState(state ? state : undefined)
            setTimeout( () => updateStatus(), 1000);
        })
    }

    setTimeout( () => updateStatus(), 1000);

    if (state && state.track_window && state.track_window.current_track) {
        return (
            <div className={'main'}>
                <h2><span className='title'>Playing: </span> {state.track_window.current_track.name}</h2>
                <Slider
                    max={state.duration}
                    min={0}
                    size={'small'}
                    value={state.position}
                />
                <div className='times'>
                    <div className='at'>{formatDuration(state.position)} </div>
                    <div className='of'>{formatDuration(state.duration)} </div>
                </div>
            </div>
        )
    } else {
        return (
            <div><h1>Nothing is playing</h1></div>
        )
    }
}