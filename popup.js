function generate_files_list(files){
    let videos = Object.keys(files)
    console.log('Files: ',files)

    let files_container = document.querySelector('.files')
    
    Array.from(files_container.children).forEach((child) => {
        files_container.removeChild(child)
    })

    videos.forEach((video) => {
        let file = files[video]

        let file_item = document.createElement('div')
        let file_item_list_item_url = document.createElement('label')
        let file_item_list_item_title = document.createElement('label')
        let file_item_list_item_download = document.createElement('button')
        let file_item_list_item_remove = document.createElement('button')
        
        file_item.append(file_item_list_item_url)
        file_item.append(file_item_list_item_title)
        file_item.append(file_item_list_item_download)
        file_item.append(file_item_list_item_remove)

        file_item.className = 'file-item'
        file_item_list_item_url.className = 'file-item-list-item__url'
        file_item_list_item_url.innerHTML = '<a href='+file.video_url+'>'+file.video_url+'</a>'
        file_item_list_item_title.className = 'file-item-list-item__title'

        file_item_list_item_download.setAttribute('data-request',file.request_url)
        file_item_list_item_download.setAttribute('data-signature',video)
        file_item_list_item_download.setAttribute('data-video',file.video_url)
        file_item_list_item_download.setAttribute('data-mime',file.mime)
        file_item_list_item_download.innerHTML = 'Download '+file.mime

        file_item_list_item_remove.setAttribute('data-request',file.request_url)
        file_item_list_item_remove.setAttribute('data-signature',video)
        file_item_list_item_remove.setAttribute('data-video',file.video_url)
        file_item_list_item_remove.setAttribute('data-mime',file.mime)
        file_item_list_item_remove.innerHTML = 'Remove '+file.mime

        file_item_list_item_title.innerHTML = file.title
        
        if(file.file != null){
            file_item_list_item_download.className = 'file-item-list-item__download-complete'
            file_item_list_item_download.addEventListener('click',download_file)
            file_item_list_item_remove.className = 'file-item-list-item__remove'
            file_item_list_item_remove.addEventListener('click',remove_file)
        }else{
            file_item_list_item_download.className = 'file-item-list-item__request-download'
            file_item_list_item_remove.className = 'file-item-list-item__remove'
            file_item_list_item_download.addEventListener('click',request_file_download)
            file_item_list_item_remove.addEventListener('click',remove_file)
        }

        // video_files.forEach((file) => {

        // })

        files_container.append(file_item)
    })
}

function remove_file(e){
    let file_signature = e.target.getAttribute('data-signature')
    chrome.storage.local.get(['files','requests','blobs'],(data) => {
        delete data['files'][file_signature]
        delete data['requests'][file_signature]
        delete data['blobs'][file_signature]
        chrome.storage.local.set({files: data['files'], requests: data['requests'], blobs: data['blobs']})
    })    
}

function download_file(e){
    let file_signature = e.target.getAttribute('data-signature')
    chrome.storage.local.get(['files'],(data) => {
        let file = data['files'][file_signature]
        let link = document.createElement('a')
        link.style.display = 'none'
        link.href = file.file
        link.download = file.title
        document.body.append(link)
        link.click()
        document.body.removeChild(link)
    })    
}


function request_file_download(e){
    e.target.disabled = true
    let request_url = e.target.getAttribute('data-request')
    let video_url = e.target.getAttribute('data-video')
    let mime = e.target.getAttribute('data-mime')
    e.target.innerHTML = 'Downloading '+mime+'...'
    connection.postMessage({msg: 'download_file', request_url: request_url, video_url: video_url})
}

let connection = chrome.runtime.connect({name: 'popup'})

chrome.storage.local.get('files',(data) => {
    if(data.hasOwnProperty('files')){
        console.log('data',data)
        generate_files_list(data['files'])
    }
})

chrome.storage.onChanged.addListener((data,areaName) => {
    if(data.hasOwnProperty('files')){
        console.log('data',data)
        generate_files_list(data['files'].newValue)
    }
})