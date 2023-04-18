let blobs = {}
let connections = []
let requests = {}

function get_signature(request_url){
    let signature_regex = /\&sig=[^&]+\&/
    let signature = request_url.match(signature_regex).pop()
    signature = signature.replace('&sig=','').replace('&','')
    return signature
}

function intercept_requests(tab_id){
    chrome.webRequest.onCompleted.addListener((request) => {
        chrome.tabs.get(tab_id,(tab) => {
            let video_url = tab.url
            if(valid_request(request.url)){
                if(request_incomplete(request.url,video_url)){
                    let is_new_request = register_request(request.url,video_url)
                    if(is_new_request){
                        request.url = modify_request(request.url,video_url)
                        process_request(request.url,video_url)
                    }
                }
            }
        })
    },{urls: ['<all_urls>']})
}

function valid_request(request_url){
    let regex = /\/videoplayback\?/
    return request_url.match(regex) != null
}

function request_incomplete(request_url,video_url){
    if(file_complete(request_url,video_url)){
        return false
    }else{
        return true
    }
}

function file_complete(request_url,video_url){
    if(has_all_chunks(request_url,video_url)){
        return true
    }else{
        return false
    }
}

function has_all_chunks(request_url,video_url){
    let file_signature = get_signature(request_url)
    if(requests.hasOwnProperty(video_url)){
        if(requests[video_url].hasOwnProperty(file_signature)){
            let chunk_list = requests[video_url][file_signature]
            if(chunk_list.length > 0){
                let has_all_bytes = true
                let last_byte_retrieved = 0
                let size = chunk_list_size(chunk_list[0])
        
                chunk_list.forEach((chunk) => {
                    let first_byte = chunk_first_byte(chunk)
                    let last_byte = chunk_last_byte(chunk)
                    if(last_byte_retrieved == 0){
                        if(last_byte_retrieved != first_byte){
                            has_all_bytes = false
                        }
                    }else{
                        if(first_byte != last_byte_retrieved+1){
                            has_all_bytes = false
                        }
                    }
                    last_byte_retrieved = last_byte
                })
        
                if(size != last_byte_retrieved+1){
                    has_all_bytes = false
                }
        
                return has_all_bytes
            }else{
                return false
            }
        }else{
            return false
        }
    }else{
        return false
    }
}

function chunk_list_size(chunk){
    let clen_regex = /\&clen=[0-9]+\&/
    let clen = chunk.match(clen_regex)[0].replace('&clen=','').replace('&','')
    let size = parseInt(clen)
    return size
}

function chunk_first_byte(chunk){
    let range_regex = /\&range=[0-9]+-[0-9]+/
    let range = chunk.match(range_regex)[0].replace('&range=','')
    let first_byte = parseInt(range.split('-').shift())
    return first_byte
}

function chunk_last_byte(chunk){
    let range_regex = /\&range=[0-9]+-[0-9]+/
    let range = chunk.match(range_regex)[0].replace('&range=','')
    let last_byte = parseInt(range.split('-').pop())
    return last_byte
}

// Requisicoe so serao registradas caso algum
// dos bytes nao tenha sido lido
function register_request(request_url,video_url){
    let file_signature = get_signature(request_url)
    if(requests.hasOwnProperty(video_url)){
        if(requests[video_url].hasOwnProperty(file_signature)){
            if(contains_new_data(request_url,video_url)){
                console.log('New data: ',chunk_first_byte(request_url),chunk_last_byte(request_url),request_url)
                request_url = modify_request(request_url,video_url)
                if(requests[video_url][file_signature].indexOf(request_url) < 0){
                    requests[video_url][file_signature].push(request_url)
                    return true
                }else{
                    return false
                }
            }else{
                return false
            }
        }else{
            requests[video_url] = {}
            requests[video_url][file_signature] = [request_url]
            return true
        }
    }else{
        requests[video_url] = {}
        requests[video_url][file_signature] = [request_url]
        return true
    }
}

function contains_new_data(request_url,video_url){
    if(requests.hasOwnProperty(video_url)){
        let file_signature = get_signature(request_url)
        if(requests[video_url].hasOwnProperty(file_signature)){
            let request_list = requests[video_url][file_signature]
            return contains_new_bytes(request_url,request_list)
        }else{
            return true
        }
    }else{
        return true
    }
}

function contains_new_bytes(request_url,request_list){
    let start = chunk_first_byte(request_url)
    let end = chunk_last_byte(request_url)
    let highest_byte = 0
    let has_new_bytes = false
    let list = order_requests_by_range(request_list)

    if(list.length > 0){
        list.every((item) => {
            let item_start = chunk_first_byte(item)
            let item_end = chunk_last_byte(item)

            if(item_start <= start){
                start = item_end+1
            }else{
                has_new_bytes = true
                return false
            }

            if(start > end){
                return false
            }
    
            if(item_end > highest_byte){
                highest_byte = item_end
            }

            return true
        })

        if(highest_byte < start){
            has_new_bytes = true
        }

    }else{
        has_new_bytes = true
    }

    //console.log('Has new bytes: ',has_new_bytes,start,end,list.map((item) => { return {start: chunk_first_byte(item), end: chunk_last_byte(item)} }))
    return has_new_bytes
}

function modify_request(request_url,video_url){
    let range = get_new_byte_range(request_url,video_url)
    let first_byte = range[0]
    let last_byte = range[1]
    let new_request = request_url
    if(last_byte >= first_byte){
        let range_regex = /\&range=[0-9]+-[0-9]+\&/
        new_request = request_url.replace(range_regex,'&range='+first_byte+'-'+last_byte+'&')
    }
    return new_request
}

function get_new_byte_range(request_url,video_url){
    let file_signature = get_signature(request_url)
    let request_list = requests[video_url][file_signature]
    let start = chunk_first_byte(request_url)
    let end = chunk_last_byte(request_url)
    let list = order_requests_by_range(request_list)

    if(list.length > 0){
        list.every((item) => {
            let item_start = chunk_first_byte(item)
            let item_end = chunk_last_byte(item)
            
            if(item_start <= start){
                start = item_end+1
            }else{
                if(end > item_start){
                    end = item_start-1
                }
            }
    
            if(start > end){
                return false
            }

            return true
        })
    }

    return [start,end]
}

function order_requests_by_range(request_list){
    request_list.sort((a,b) => {
        let a_end = chunk_last_byte(a)
        let b_start = chunk_first_byte(b)
        let b_end = chunk_last_byte(b)

        if(a_end > b_end){
            return 1
        }else if(a_end < b_start){
            return -1
        }else{
            console.log('INVALID RANGE: ',a_end,b_start,b_end)
            return 0
        }
    })

    return request_list
}

function process_request(request_url,video_url){
    save_request_data(request_url,video_url)
    .then(data => { check_file_progress(request_url,video_url) })
}

function save_request_data(request_url,video_url){
    let file_signature = get_signature(request_url)
    return fetch(request_url,{method: 'POST'})
    .then(data => data.blob())
    .then(data => {
        let first_byte = chunk_first_byte(request_url)
        let last_byte = chunk_last_byte(request_url)
        if(blobs.hasOwnProperty(video_url)){
            if(blobs[video_url].hasOwnProperty(file_signature)){
                blobs[video_url][file_signature].push({data: data, first_byte: first_byte, last_byte: last_byte})
            }else{
                blobs[video_url][file_signature] = [{data: data, first_byte: first_byte, last_byte: last_byte}]
            }
        }else{
            blobs[video_url] = {}
            blobs[video_url][file_signature] = [{data: data, first_byte: first_byte, last_byte: last_byte}]
        }
    })
}

function check_file_progress(request_url,video_url){
    if(is_last_request(request_url)){
        console.log('last request!')
        create_file(request_url,video_url)
    }else{
        console.log(request_url)
    }
}

function is_last_request(url){
    let range = /\&range=[0-9]+-[0-9]+\&/
    let clen = /\&clen=[^\&]+\&/
    range = url.match(range).pop()
    clen = url.match(clen).pop()
    range = range.replace('&range=','').replace('&','')
    clen = clen.replace('&clen=','').replace('&','')
    end = parseInt(range.split('-').pop())
    bits_quantity = parseInt(clen)
    return bits_quantity == end + 1
}

function create_file(request_url,video_url){
    let file_signature = get_signature(request_url)
    let list = order_requests_by_range(requests[video_url][file_signature])
    list = list.map((item) => { return {start: chunk_first_byte(item), end: chunk_last_byte(item) } })
    console.log('List: ',list)
    get_missing_bytes(request_url,video_url)
    .then(data => {
        console.log('CREATING FILE...')
        let mime = get_mime(request_url)
        let file_name = video_url+'.'+mime.split('/').pop()
        let file = null
        blobs[video_url][file_signature].sort((a,b) => {
            if(a.last_byte < b.first_byte){
                return -1
            }else if(a.first_byte > b.last_byte){
                return 1
            }
        })
        console.log('Blobs: ',blobs.map((blob) => {
            return {first_byte: blob.first_byte, last_byte: blob.last_byte}
        }))
        file = new File(blobs[video_url][file_signature],file_name,{type: mime})
        let file_reader = new FileReader()
        file_reader.addEventListener('load',() => {
            let file_content = file_reader.result
            store_file(request_url,video_url,file_content,file_name)
        })
        file_reader.readAsDataURL(file)
    })
}

function get_missing_bytes(request_url,video_url){
    let holes = []
    let last_byte = null
    let file_signature = get_signature(request_url)
    let request_list = requests[video_url][file_signature]
    let list = order_requests_by_range(request_list)

    if(list.length > 0){
        list.forEach((item) => {
            let item_start = chunk_first_byte(item)
            let item_end = chunk_last_byte(item)
            
            if(last_byte == null){
                if(item_start != 0){
                    holes.push({start: 0, end: item_start-1})
                }
            }else if(item_start > last_byte+1){
                holes.push({start: last_byte+1, end: item_start-1})
            }
            
            last_byte = item_end
        })
    }

    return Promise.all(holes.map((hole) => {
        let range_regex = /\&range=[0-9]+-[0-9]+\&/
        let hole_request = request_url.replace(range_regex,'&range='+hole.start+'-'+hole.end+'&')
        if(register_request(hole_request)){
            return save_request_data(hole_request,video_url)
        }else{
            return new Promise((resolve,reject) => { resolve() })
        }
    }))
}

function get_mime(request_url){
    let mime_regex = /\&mime=[^&]+\&/
    let mime = request_url.match(mime_regex).pop()
    mime = mime.replace('&mime=','').replace('&','').replace('%2F','/').pop()
    return mime
}

function store_file(request_url,video_url,file,file_name){
    chrome.storage.local.get(['files'],(data) => {
        let files = {}
        let file_signature = get_signature(request_url)
        if(data.hasOwnProperty('files')){
            files = data['files']
            if(files.hasOwnProperty(video_url)){
                if(!files[video_url].hasOwnProperty(file_signature)){
                    files[video_url][file_signature] = {file: file, name: file_name}
                    update_files(files)
                }
            }else{
                files[video_url] = {}
                files[video_url][file_signature] = {file: file, name: file_name}
                update_files(files)
            }
        }else{
            files[video_url] = {}
            files[video_url][file_signature] = {file: file, name: file_name}
            update_files(files)
        }
    })
}

function update_files(files){
    chrome.storage.local.set({files: files},() => {
        chrome.action.getBadgeText({},(text) => {
            let new_text = ''
            if(text != ''){
                new_text = (parseInt(text)+1).toString()
            }else{
                new_text = '1'
            }
            chrome.action.setBadgeText({text: new_text})
        })
        console.log('File saved in storage!',files)
    })
}

chrome.runtime.onConnect.addListener((conn) => {
    connections[conn.name] = conn
    conn.onMessage.addListener((msg,port) => {
        let tab_id = port.sender.tab.id
        switch(msg.msg){
            case 'youtube_tab':
                intercept_requests(tab_id)
                break;
            default:
                break;
        }
    })
})

// Filtra requisições e as guarda em um array de requisições
// Ao detectar a ultima requisição, inicia o processo de recriação do vídeo
// Refaz cada uma das requisições salvas
// Recupera body em formato blob p/ cada requisição
// Adiciona o blob em um array de blobs
// Ao realizar a ultima requisição do vídeo, cria um File a partir de todos os blobs
// Disponibiliza arquivo para download

// https://rr3---sn-gpv7ynes.googlevideo.com/videoplayback?expire=1681182228
// #&ei=tHk0ZKjfJJLrwASxkI0w
// &ip=164.163.86.253
// #&id=o-ANR-zX0WIG44LmTuFXQrzSQ08PET8GAXgjiBsE-g12Jm
// &itag=251
// &source=youtube
// &requiressl=yes
// &mh=lG
// &mm=31,26
// #&mn=sn-pmcg-4vgl,sn-gpv7ynes
// &ms=au,onr
// &mv=m
// &mvi=13
// &pl=23
// &initcwndbps=1022500
// #&spc=99c5Cb8pTuKkaobKkXQjhFvHcW_AlXkDJzUiKn390O33m1Ous7PiV6M
// &vprv=1
// #&mime=audio/webm
// #&ns=pxI05ZXD5dd1mYJdoaipNj4M
// &gir=yes
// &clen=47437145
// &dur=3868.261
// &lmt=1681144772053974
// &mt=1681160234
// &fvip=3
// &keepalive=yes
// &fexp=24007246
// &c=WEB
// &txp=5432434
// #&n=ibijCZhvxgS_FQ
// &sparams=expire,ei,ip,id,itag,source,requiressl,spc,vprv,mime,ns,gir,clen,dur,lmt
// &sig=AOq0QJ8wRAIgaxRxHSDfnQkUkWFEnPDDbZSSorCo8HK7IvaZ5vZJj48CIDPgKvPSort1ezBLMAr-gDw6GksQeRZiH_he3CUt9ny7
// &lsparams=mh,mm,mn,ms,mv,mvi,pl,initcwndbps
// #&lsig=AG3C_xAwRQIhANAul_mSGiUcJRcrc8j6w2HEXq3u87Re7bsNgMvUuU2SAiBBtGYsmlgdPvS7M9x06FOwk8DNALno9kOoLhPAv4gw8w==
// &alr=yes
// #&cpn=h-0ZoePyzDzJFgnt
// &cver=2.20230331.00.00
// &fallback_count=1
// &range=39242018-39615253
// &rn=383
// &rbuf=119713
// &pot=MqoB3gsNsCiMf1_eM3Xt0tY6Wcndh15AwEqkz1M2xEzc44ZDRgEd2fisNOzjokV9l_0LdVGdTwehiCZQh5Mozk3ocyZyDYglC0vwcc8p3gPT7pNSmBAufTsSIdlll5jsasBH55vuufVD05rrWqaGIb38bZ6pc7_wbFwQ0bhTf87aXsTG2wzth250W2X-yKd_iUP6WlJxpAWhX0wqw4DMPiCY66u3_0uyFxlfy9w=

// fetch(a,{method: 'POST'})
// .then(data => { return data.json() })
// .then(data => { console.log('Data: ',data) })
// .catch(err => { console.log('err') })


// https://rr3---sn-bg07dnre.googlevideo.com/videoplayback?expire=1681271776
// &ei=gNc1ZOy_BY2C5gTqt7-4Cg
// &ip=164.163.86.253
// &id=o-AFOJkdQ5PMY50sHGqtVb586qI0hVTcS0YL3EkNEc8U6W
// &itag=251
// &source=youtube
// &requiressl=yes
// &gcr=br
// &vprv=1
// &mime=audio/webm
// &ns=PN-hXMufAeWufxnPotXfgzIM
// &gir=yes
// &clen=5498462
// &dur=319.941
// &lmt=1595096402795350
// &keepalive=yes
// &fexp=24007246
// &c=WEB
// &txp=5431432
// &n=aTiBUD6zHFbXVQ
// &sparams=expire,ei,ip,id,itag,source,requiressl,gcr,vprv,mime,ns,gir,clen,dur,lmt
// &alr=yes
// &sig=AOq0QJ8wRQIgQLgGcBgwnfJe-U-YfXmNW1tAPq7fqVk_Q2ci6j73NVwCIQDHVjkFyGa4_QQzPb5SpkPA0rIgPOYQTXpTZ8MBSLiiJA==
// &cpn=e-qZEf5ovtBEZqve
// &cver=2.20230331.00.00
// &redirect_counter=1
// &rm=sn-pmcg-4vglel
// &cms_redirect=yes
// &cmsv=e
// &ipbypass=yes
// &mh=ZO
// &mm=30
// &mn=sn-bg07dnre
// &ms=nxu
// &mt=1681249943
// &mv=m
// &mvi=3
// &pl=23
// &lsparams=ipbypass,mh,mm,mn,ms,mv,mvi,pl
// &lsig=AG3C_xAwRgIhALzejKRaY-MeLDKAhcVWam3fHZUetWOC62MRD6NIvAQkAiEAsio1alxFX-Rf0KFb-90BFPN27KyPvimKDSoRQyG-wUQ=
// &range=2387301-2922391
// &rn=21&rbuf=78196&pot=MnBycd8oDVTXgnJJIlJ1ZCEs_q9jUa-LBJtfpIPymEEh5nUlr12XJsokcI_hNrguQXHk2aKDdnc7nt2XrjUb5awD5szzUMn3PupiZA9-fbZo24Qqyuz4b-i-xV02_i5rnax-FNgkI2jSdHE3g_AtZ9Z4
