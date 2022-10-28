import {createRef, useEffect, useState} from "react";
import {readString} from "react-papaparse";
import SpotifyWebPlayer from "react-spotify-web-playback";
import {fetchSpotify, formatDuration, refreshToken} from "./util";
import "./spotify_spin_player.css"
import {NowDoing} from "./now_doing";

const TRACK_COL = 4;

function csvToMix(csv, setMix) {
    csv.shift();
    let result = [];
    for (let i = 0; i < csv.length; i++) {
        if (!csv[i][0] || csv[i][0].trim().startsWith('#') || csv[i][0].trim().length === 0) {
            continue;
        }
        if (csv[i][TRACK_COL]) {
            const spotTrack1 = csv[i][TRACK_COL].lastIndexOf(':');
            const spotTrack2 = csv[i][TRACK_COL].lastIndexOf('/');
            let spotTrack;
            if (spotTrack1 > spotTrack2 && spotTrack1 > 0) {
                spotTrack = csv[i][TRACK_COL].substr(spotTrack1 + 1);
            } else if (spotTrack2 > spotTrack1 && spotTrack2 > 0) {
                spotTrack = csv[i][TRACK_COL].substr(spotTrack2 + 1);
            } else {
                spotTrack = csv[i][TRACK_COL];
            }
            csv[i][TRACK_COL] = spotTrack;
        }
        result.push({
            exercise: csv[i][0],
            intensity: csv[i][1],
            startAt: csv[i][2],
            duration: csv[i][3] ? parseInt(csv[i][3]) : undefined,
            track: csv[i][4],
            song: csv[i][5],
        })
    }
    updateTitles(result, setMix);
}

function updateBpmInfo(mix, track) {
    for (let i = 0; i < mix.length; i++) {
        if (mix[i].track === track.id) {
            mix[i].bpm = track.tempo;
        }
    }
}

function updateTrackInfo(mix, track) {
    for (let i = 0; i < mix.length; i++) {
        if (mix[i].track === track.id) {
            mix[i].title = track.name;
            mix[i].album = track.album.name
            mix[i].duration_ms = track.duration_ms
            mix[i].artist = track.album.artists.map(a => a.name).join(',');
        }
    }
}

function updateTitles(mix, setMix) {
    const spotifyUris = mix.map(row => row.track).filter(track => !!track).join(',');
    fetchSpotify('tracks', spotifyUris)
        .then(value => {
            value.tracks.forEach(track => {
                updateTrackInfo(mix, track);
            })
            mix[0].programStartAtMs = 0;
            mix[0].programEndAtMs = get_duration(mix, 0);
            mix[0].trackStartAt = parseInt(mix[0].startAt) * 1000 || 0;
            mix[0].trackEndAt = mix[0].trackStartAt + get_duration(mix, 0);
            for (let i = 1; i < mix.length; i++) {
                mix[i].programStartAtMs = mix[i - 1].programEndAtMs;
                mix[i].programEndAtMs = get_duration(mix, i) + mix[i].programStartAtMs;
                if (mix[i].track) {
                    mix[i].trackStartAt = parseInt(mix[i].startAt) * 1000 || 0;
                } else {
                    mix[i].trackStartAt = parseInt(mix[i - 1].trackEndAt);
                }
                mix[i].trackEndAt = mix[i].trackStartAt + get_duration(mix, i);
            }
            setMix(mix)
        });

    fetchSpotify('audio-features', spotifyUris)
        .then(value => {
            value.audio_features.forEach(track => {
                updateBpmInfo(mix, track);
            })
            setMix(mix)
        });
}

function get_duration(mix, idx) {
    if (!mix || idx === undefined || idx >= mix.length) {
        return undefined;
    }
    const row = mix[idx];
    if (row.duration) {
        return row.duration * 1000;
    }
    if (row.duration_ms) {
        return (row.duration_ms / 1000 - (row.startAt || 0)) * 1000;
    }
    let total = 0;
    for (let i = idx - 1; i >= 0; i--) {
        const prev_duration = get_duration(mix, i);
        total += prev_duration;
        if (mix[i].track) {
            const trackDuration = mix[i].duration_ms - (parseInt(mix[i].startAt) * 1000 || 0);
            return trackDuration - total;
        }
    }
    return 0;
}

function getTrackUris(mix) {
    return mix
        .map(m => m.track)
        .filter(track => !!track)
        .map(track => `spotify:track:${track}`);
}

export function SpotifySpinPlayer(_props, _state) {
    const [mix, setMix] = useState();
    const [current, setCurrent] = useState(undefined);
    const [at, setAt] = useState(undefined);
    const [offset, setOffset] = useState(0);
    const [forcedTrackAt, setForcedTrackAt] = useState(undefined);
    const [accessToken, setAccessToken] = useState(window.getCookie('spotTokenA'))

    useEffect( () => {
        const refresh = () => refreshToken()
            .then( () => setAccessToken(window.getCookie('spotTokenA')));
        setInterval(refresh, 1000 * 60 * 30)
        refresh().then( () => console.log("Refreshed access token"));
    }, []);


    const spotPlayer = createRef();

    const activeTimer = [];

    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => searchParams.get(prop),
    });
    const mixCsv = params.mix; // "some_value"

    if (mixCsv && !mix) {
        console.log("Fetching mix");
        fetch(`/api/static/mixes/${mixCsv}.csv`).then((response) =>
            response.text().then((csv) => readString(csv, {
                    worker: true,
                    complete: (results) => {
                        console.log("Setting mix");
                        csvToMix(results.data, setMix)
                    }
                })
            )
        )
    }

    function receiveState1(state) {
        receiveState2(state?.track?.id, state?.progressMs, true);
        if (forcedTrackAt) {
            spotPlayer?.current?.player.seek(forcedTrackAt);
            setForcedTrackAt(undefined);
        }
    }

    function getSongAt(idx) {
        let at = -1;
        for (let i = 0; i <= idx; i++) {
            if (mix[i].track) {
                at++;
            }
        }
        return at;
    }

    function receiveState2(trackId, progressMs, fromSpot) {
        if (!trackId) {
            console.log("Received state udpate to undefined");
            setCurrent(undefined);
            setAt(undefined);
            return;
        }
        let i = 0;
        for (; i < mix.length; i++) {
            if (mix[i].track === trackId) {
                if (mix[i].startAt && progressMs < mix[i].startAt * 1000) {
                    console.log("Seeking to " + mix[i].startAt * 1000);
                    spotPlayer.current.player.seek(mix[i].startAt * 1000);
                    progressMs = mix[i].startAt * 1000
                }
                break;
            }
        }
        for (; i < mix.length; i++) {
            if (progressMs < mix[i].trackEndAt || (mix[i].track && mix[i].track !== trackId) ) {
                break;
            }
        }
        setCurrent(i);
        const tmpOffset = progressMs - mix[i].trackStartAt;
        const programPosition = mix[i].programStartAtMs + tmpOffset;
        setAt(programPosition);
        const tmpSongAt = getSongAt(i);
        if (tmpSongAt !== offset) {
            console.log(`Synching offset to ${i}/${tmpSongAt}`)
            setOffset(tmpSongAt);
        }
        console.log(`Offset==${offset}, Idx==${i}, positionInProgram==${formatDuration(programPosition)}, fromSpot==${fromSpot}`);
    }

    function updateState() {
        spotPlayer?.current?.player?.getCurrentState()?.then((state) => {
            scheduleUpdate(false);
            receiveState2(state?.track_window?.current_track?.id, state?.position, false);
        });
    }

    function scheduleUpdate(clearOnly) {
        activeTimer.forEach(t => clearTimeout(t));
        activeTimer.splice(0, activeTimer.length);
        if (!clearOnly) {
            activeTimer.push(setTimeout(updateState, 1000));
        }
    }

    function moveToIndex(idx) {
        const mixToGoTo = mix[idx];
        let tmpOffset = getSongAt(idx);
        console.log(`Moving to song #${tmpOffset} (current==${offset})`)
        setOffset(tmpOffset);
        if (tmpOffset !== offset) {
            if (mixToGoTo.trackStartAt > 0) {
                setForcedTrackAt(mixToGoTo.trackStartAt);
            }
        } else {
            spotPlayer?.current?.player?.seek(mixToGoTo.trackStartAt)
        }
    }

    if (mix) {
        scheduleUpdate(forcedTrackAt !== undefined)
        const trackUris = getTrackUris(mix)
        return (
            <div className={'root'}>
                <div className={'controls'}>
                    <SpotifyWebPlayer
                        ref={spotPlayer}
                        token={accessToken}
                        uris={trackUris}
                        offset={offset}
                        callback={receiveState1}
                        name={'spotSpinPlayer'}
                        persistDeviceSelection={true}
                        play={true}
                    />
                    <NowDoing
                        mix={mix}
                        current={current}
                        at={at}
                    />
                </div>
                <div className={'container'}>
                    <table border={1}>
                        <thead>
                        <tr>
                            <td>#</td>
                            <td className='duration'>Program Time</td>
                            <td className='duration'>Track Time</td>
                            <td className='duration'>Exercise Duration</td>
                            <td>Exercise</td>
                            <td className='duration'>Cadence</td>
                            <td>Song</td>
                            <td>Album</td>
                            <td>Artist</td>
                            <td className='duration'>Track Start At</td>
                            <td className='duration'>Track Duration</td>
                            <td>Track Id</td>
                        </tr>
                        </thead>
                        <tbody>
                        {
                            mix.map((m, idx) => {
                                return (
                                    <tr className={idx < current ? 'played' : current === idx ? 'active' : 'to_come'}
                                        onClick={() => moveToIndex(idx)}
                                        key={'e' + idx}>
                                        <td className={'duration'}>{idx}</td>
                                        <td className='duration'>{formatDuration(mix[idx].programStartAtMs)}</td>
                                        <td className='duration'>{formatDuration(mix[idx].trackStartAt)}</td>
                                        <td className={'duration ' + (m.duration ? '' : 'calculated')}>
                                            {formatDuration(get_duration(mix, idx))}
                                        </td>
                                        <td>{m.exercise}</td>
                                        <td className='duration'>{m.bpm && (m.bpm > 110 ? Math.round(m.bpm / 2) : Math.round(m.bpm))}</td>
                                        <td>{m.title}</td>
                                        <td>{m.album}</td>
                                        <td>{m.artist}</td>
                                        <td className='duration'>{m.startAt}</td>
                                        <td className='duration'>{formatDuration(m.duration_ms)}</td>
                                        <td>{m.track}</td>
                                    </tr>
                                );
                            })
                        }
                        </tbody>
                    </table>
                </div>
            </div>
        );
    } else {
        return (<div>Loading ...</div>);
    }
}
