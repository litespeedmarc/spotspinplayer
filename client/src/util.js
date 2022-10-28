export const zeroPad = (num, places) => String(num).padStart(places, '0')

export function formatDuration(duration_ms) {
    if (duration_ms === 0) {
        return '0:00';
    }
    if (!duration_ms) {
        return '';
    }
    const duration_seconds = duration_ms / 1000;
    const minutes = Math.floor(duration_seconds / 60);
    const seconds = zeroPad(Math.floor(duration_seconds - minutes * 60), 2);
    return `${minutes}:${seconds}`
}

export function refreshToken() {
    return fetch(`/api/refresh_token`, {
        credentials: 'include'
    }).then( response => {
        console.log(`Refreshed token.  Got ${response.status} status`)
        return response;
    })
}

export function fetchSpotify(resource, ids, recursive) {
    console.log(`Fetching ${resource} from spotify (recursive=${recursive})`);
    return fetch(`https://api.spotify.com/v1/${resource}?ids=${ids}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.getCookie('spotTokenA')}`
        }
    }).then(response => {
        if (response.status === 401 && !recursive) {
            console.log(`Got 401 fetching ${resource}, attempting to refresh token`);
            return refreshToken()
                .then( () => fetchSpotify(resource, ids, true));
        } else {
            console.log(`Retrieved ${resource} from spotify (status=${response.status})`);
            return response.json()
        }
    })
}