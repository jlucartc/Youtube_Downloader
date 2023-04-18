let blobs = {}
let requests = {}
let title = {}
let itag_codes = {
    5: 'flv audio/video 240p',
    6: 'flv audio/video 270p',
    17: '3gp audio/video 144p',
    18: 'mp4 audio/video 360p',
    22: 'mp4 audio/video 720p',
    34: 'flv audio/video 360p',
    35: 'flv audio/video 480p',
    36: '3gp audio/video 180p',
    37: 'mp4 audio/video 1080p',
    38: 'mp4 audio/video 3072p',
    43: 'webm audio/video 360p',
    44: 'webm audio/video 480p',
    45: 'webm audio/video 720p',
    46: 'webm audio/video 1080p',
    82: 'mp4 audio/video 360p 3D',
    83: 'mp4 audio/video 480p 3D',
    84: 'mp4 audio/video 720p 3D',
    85: 'mp4 audio/video 1080p 3D',
    92: 'hls audio/video 240p 3D',
    93: 'hls audio/video 360p 3D',
    94: 'hls audio/video 480p 3D',
    95: 'hls audio/video 720p  3D',
    96: 'hls audio/video 1080p',
    100: 'webm audio/video 360p 3D',
    101: 'webm audio/video 480p 3D',
    102: 'webm audio/video 720p 3D',
    132: 'hls audio/video 240p',
    133: 'mp4 video 240p',
    134: 'mp4 video 360p',
    135: 'mp4 video 480p',
    136: 'mp4 video 720p',
    137: 'mp4 video 1080p',
    138: 'mp4 video 2160p60',
    139: 'm4a audio 48k',
    140: 'm4a audio 128k',
    141: 'm4a audio 256k',
    151: 'hls audio/video 72p',
    160: 'mp4 video 144p',
    167: 'webm video 360p',
    168: 'webm video 480p',
    169: 'webm video 1080p',
    171: 'webm audio 128k',
    218: 'webm video 480p',
    219: 'webm video 144p',
    242: 'webm video 240p',
    243: 'webm video 360p',
    244: 'webm video 480p',
    245: 'webm video 480p',
    246: 'webm video 480p',
    247: 'webm video 720p',
    248: 'webm video 1080p',
    249: 'webm audio 50k',
    250: 'webm audio 70k',
    251: 'webm audio 160k',
    264: 'mp4 video 1440p',
    266: 'mp4 video 2160p60',
    271: 'webm video 1440p',
    272: 'webm video 4320p',
    278: 'webm video 144p',
    298: 'mp4 video 720p60',
    299: 'mp4 video 1080p60',
    302: 'webm video 720p60',
    303: 'webm video 1080p60',
    308: 'webm video 1440p60',
    313: 'webm video 2160p',
    315: 'webm video 2160p60',
    330: 'webm video 144p60 hdr',
    331: 'webm video 240p60 hdr',
    332: 'webm video 360p60 hdr',
    333: 'webm video 480p60 hdr',
    334: 'webm video 720p60 hdr',
    335: 'webm video 1080p60 hdr',
    336: 'webm video 1440p60 hdr',
    337: 'webm video 2160p60 hdr',
}

function get_itag(request_url){
    let itag_regex = /\&itag=[^&]+\&/
    let itag = request_url.match(itag_regex).pop()
    itag = itag.replace('&itag=','').replace('&','')
    return itag_codes[itag]
}

function get_signature(request_url,video_url){
    let itag_regex = /\&itag=[^&]+\&/
    let itag = request_url.match(itag_regex).pop()
    itag = itag.replace('&itag=','').replace('&','')
    return video_url+itag
}

function intercept_requests(tab_id){
    chrome.tabs.get(tab_id,(tab) => {
        chrome.webRequest.onCompleted.addListener((request) => {
            chrome.tabs.get(tab_id,(current_tab) => {                
                if(current_tab != undefined){
                    if(title.hasOwnProperty(tab_id)){
                        if(title[tab_id] != current_tab.title){
                            title[tab_id] = current_tab.title
                        }
                    }else{
                        title[tab_id] = current_tab.title
                    }
                    let video_url = current_tab.url
                    let video_title = title[tab_id]
                    if(valid_request(request)){
                        process_request(request.url,video_url,video_title)
                    }
                }
            })
        },{urls: ['<all_urls>'], tabId: tab_id})
    })
}

function valid_request(request){
    let regex = /googlevideo\.com\/videoplayback\?/
    return request.url.match(regex) != null
}

function process_request(request_url,video_url,video_title){
    load_data().then(data => {
        let file_signature = get_signature(request_url,video_url)
        if(!requests.hasOwnProperty(file_signature)){
            if(request_size(request_url) != null){
                requests[file_signature] = {title: video_title, mime: get_mime_description(request_url), requests: generate_requests(request_url)}
                save_file(request_url,video_url)
            }
        }else{
            update_title(request_url,video_url,video_title)
        }
    })
}

function load_data(){
    return chrome.storage.local.get(['requests','blobs'])
    .then(data => {
        if(data.hasOwnProperty('requests')){
            requests = data['requests']
        }else{
            requests = {}
        }

        if(data.hasOwnProperty('blobs')){
            blobs = data['blobs']
        }else{
            blobs = {}
        }
    })
}

function generate_requests(request_url){
    let request_quantity = 100
    let current_byte = -1
    let size = request_size(request_url)
    let request_size = Math.floor(size/request_quantity)
    let request_list = Array(request_quantity).fill('')
    let list = request_list.map((item,index) => {
        let range_regex = /\&range=[0-9]+-[0-9]+\&/
        let start = current_byte+1
        let end = start + request_size
        if(index == request_quantity-1){
            end = size-1
        }
        current_byte = end
        return request_url.replace(range_regex,'&range='+start+'-'+end+'&')
    })
    return list
}

function request_size(request_url){
    let clen_regex = /\&clen=[0-9]+\&/
    let size = null
    if(request_url.match(clen_regex) != null){
        let clen = request_url.match(clen_regex)[0].replace('&clen=','').replace('&','')
        size = parseInt(clen)
    }
    return size
}

function update_title(request_url,video_url,video_title){
    let file_signature = get_signature(request_url,video_url)
    chrome.storage.local.get(['files'])
    .then(data => {
        if(data.hasOwnProperty('files') && data['files'].hasOwnProperty(file_signature)){
            data['files'][file_signature].title = video_title
            chrome.storage.local.set({files: data['files']})
        }
    })
}

function save_file(request_url,video_url){
    let file_signature = get_signature(request_url,video_url)
    chrome.storage.local.get(['files'],(data) => {
        if(data.hasOwnProperty('files')){
            if(data['files'].hasOwnProperty(file_signature)){
                data['files'][file_signature] = {
                    request_url: request_url,
                    video_url: video_url,
                    title: requests[file_signature].title,
                    mime: requests[file_signature].mime,
                    file: null
                }
            }else{
                data['files'][file_signature] = {
                    request_url: request_url,
                    video_url: video_url,
                    title: requests[file_signature].title,
                    mime: requests[file_signature].mime,
                    file: null
                }
            }
        }else{
            data['files'] = {}
            data['files'][file_signature] = {
                request_url: request_url,
                video_url: video_url,
                title: requests[file_signature].title,
                mime: requests[file_signature].mime,
                file: null
            }
        }
        chrome.storage.local.set({files: data['files'],blobs: blobs, requests: requests},() => {
        })
    })
}

function get_mime_description(request_url){
    let itag = get_itag(request_url)
    if(itag != undefined){
        return itag
    }else{
        return get_mime(request_url)
    }
}

function get_mime(request_url){
    let mime_regex = /\&mime=[^&]+\&/
    let mime = request_url.match(mime_regex).pop()
    mime = mime.replace('&mime=','').replace('&','').replace('%2F','/')
    return mime
}

function download_file(request_url,video_url){
    let file_signature = get_signature(request_url,video_url)
    let request_list = requests[file_signature].requests
    let mime = get_mime(request_url)
    let file_name = video_url+'.'+mime.split('/').pop()
    let promise = Promise.all(request_list.map((request,index) => {
        return fetch(request,{method: 'POST'})
        .then(data => data.blob())
        .then(data => {
            let blob_structure = {
                data: [
                    {
                        content: data,
                        id: index
                    }
                ],
                name: file_name,
                mime: mime,
                id: index
            }
            if(blobs.hasOwnProperty(file_signature)){
                blobs[file_signature].data.push({content: data, id: index})
            }else{
                blobs[file_signature] = blob_structure
            }
            return {content: data, id: index}
        })
    }))

    promise.then(data => {
        chrome.storage.local.get(['files'])
        .then((data) => {
            let file_name = blobs[file_signature].name
            let file_mime = blobs[file_signature].mime
            let sorted_data = blobs[file_signature]
                              .data
                              .sort((a,b) => {
                                    return a.id - b.id
                              })
                              .map((data) => {
                                    return data.content
                              })
            let file = new File(sorted_data,file_name,{type: file_mime})
            let reader = new FileReader()
            reader.addEventListener('load',() => {
                data['files'][file_signature].file = reader.result
                chrome.storage.local.set({files: data['files']})
                .then(() => {
                    chrome.action.getBadgeText({})
                    .then((text) => {
                        let new_text = ''
                        if(text != ''){
                            new_text = (parseInt(text)+1).toString()
                        }else{
                            new_text = '1'
                        }
                        chrome.action.setBadgeText({text: new_text})
                    })
                })
            })
            reader.readAsDataURL(file)
        })
    })
}

chrome.runtime.onConnect.addListener((conn) => {
    conn.onMessage.addListener((msg,port) => {
        switch(msg.msg){
            case 'youtube_tab':
                let tab_id = port.sender.tab.id
                intercept_requests(tab_id)
                break;
            case 'download_file':
                download_file(msg.request_url,msg.video_url)
            default:
                break;
        }
    })
})

chrome.storage.local.get(['requests','blobs'])
.then((data) => {
    if(data.hasOwnProperty('requests')){
        requests = data['requests']
    }

    if(data.hasOwnProperty('blobs')){
        blobs = data['blobs']
    }
})