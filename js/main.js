var productsXml = null;     // DOM cua products.xml
var ratings = {};           // product_id -> { sum, count, avg, list: [ {customerId, rating, comment, date} ] }
var customers = {};         // customerId -> fullName (tu customers.json)
var gridId = "gridProducts";

/* ======================================================
 * LOAD DU LIEU
 * ====================================================== */

/**
 * Hien skeleton, doc products.xml (DOM) -> reviews.xml (DOMParser) -> customers.json, roi render luoi san pham
 * @param {*} dataset - duong dan products.xml
 * @param {*} reviewSet - duong dan reviews.xml
 * @param {*} customerSet - duong dan customers.json
 * @param {*} cbCategory - id droplist danh muc
 * @param {*} dlColors - id datalist mau sac
 * @param {*} grid - id container chua cac san pham
 */
function load_products(dataset, reviewSet, customerSet, cbCategory, dlColors, grid)
{
    gridId = grid;
    init_toast();
    init_filter();
    show_skeleton(grid, 8);
    // Cau 4: DUY NHAT 1 event listener tren container cha
    document.getElementById(grid).addEventListener("click", on_grid_click);

    http_get(dataset, function(xhr)
    {
        productsXml = xhr.responseXML;
        load_categories(cbCategory);
        load_colors(dlColors);
        http_get(reviewSet, function(xhr2)
        {
            load_reviews(xhr2.responseText);
            http_get(customerSet, function(xhr3)
            {
                var list = JSON.parse(xhr3.responseText);
                for(var i = 0; i < list.length; i++)
                    customers[list[i].customerId] = list[i].fullName;
                // tre them 1 chut de nhin thay hieu ung skeleton
                setTimeout(function() { show_products(grid, null); }, 900);
            });
        });
    });
}

function http_get(url, cb)
{
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.send();
    xhr.onreadystatechange = function()
    {
        if(this.readyState == 4)
        {
            if(this.status == 200)
                cb(xhr);
            else
                document.getElementById("pResult").innerHTML = "Không tải được " + url + " (hãy chạy bằng Live Server).";
        }
    }
}

/** Nap danh muc khong trung nhau vao droplist */
function load_categories(cbCategory)
{
    cbCategory = document.getElementById(cbCategory);
    var products = productsXml.getElementsByTagName("product");
    var seen = [];
    for(var i = 0; i < products.length; i++)
    {
        var value = products[i].getAttribute("category");
        if(seen.indexOf(value) != -1)
            continue;
        seen.push(value);
        var option = document.createElement("option");
        option.value = value;
        option.innerHTML = products[i].getElementsByTagName("categoryName")[0].childNodes[0].nodeValue;
        cbCategory.appendChild(option);
    }
}

/** Nap mau sac khong trung nhau vao datalist */
function load_colors(dlColors)
{
    dlColors = document.getElementById(dlColors);
    var colors = productsXml.getElementsByTagName("color");
    var seen = [];
    for(var i = 0; i < colors.length; i++)
    {
        var c = colors[i].childNodes[0].nodeValue;
        if(seen.indexOf(c) != -1)
            continue;
        seen.push(c);
        var option = document.createElement("option");
        option.value = c;
        dlColors.appendChild(option);
    }
}

/* ======================================================
 * CAU 5: DOMParser doc reviews.xml, tinh diem trung binh theo product_id
 * ====================================================== */
function load_reviews(xmlText)
{
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlText, "text/xml");
    var reviews = xmlDoc.getElementsByTagName("review");
    ratings = {};
    for(var i = 0; i < reviews.length; i++)
    {
        var r = reviews[i];
        var pid = r.getAttribute("product_id");
        var rating = parseFloat(r.getElementsByTagName("rating")[0].childNodes[0].nodeValue);
        if(ratings[pid] == undefined)
            ratings[pid] = { sum: 0, count: 0, avg: 0, list: [] };
        ratings[pid].sum += rating;
        ratings[pid].count++;
        ratings[pid].list.push({
            customerId: r.getAttribute("customer_id"),
            rating: rating,
            comment: r.getElementsByTagName("comment")[0].childNodes[0].nodeValue,
            date: r.getElementsByTagName("date")[0].childNodes[0].nodeValue
        });
    }
    for(var pid in ratings)
        ratings[pid].avg = Math.round(ratings[pid].sum / ratings[pid].count * 10) / 10;
}

/** Tao the <span> sao trung binh de chen len anh san pham */
function create_star_span(pid)
{
    var span = document.createElement("span");
    if(ratings[pid] == undefined)
    {
        span.className = "stars none";
        span.innerHTML = "Chưa có đánh giá";
    }
    else
    {
        span.className = "stars";
        span.innerHTML = "★ " + ratings[pid].avg.toFixed(1) + " <small>(" + ratings[pid].count + ")</small>";
    }
    return span;
}

/* ======================================================
 * CAU 3: SKELETON LOADING + RENDER LUOI
 * ====================================================== */
function show_skeleton(grid, n)
{
    grid = document.getElementById(grid);
    grid.innerHTML = "";
    for(var i = 0; i < n; i++)
    {
        var card = document.createElement("article");
        card.className = "card skeleton";
        card.innerHTML = '<div class="sk sk-img"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div>' +
                         '<div class="sk sk-line shorter"></div><div class="sk sk-btn"></div>';
        grid.appendChild(card);
    }
}

function get_text(parent, tag)
{
    return parent.getElementsByTagName(tag)[0].childNodes[0].nodeValue;
}

/** Doi ten mau tieng Viet sang ma mau de hien thi cham mau */
function color_code(name)
{
    var map = {
        "Đen": "#1f2937", "Trắng": "#ffffff", "Xám": "#9ca3af", "Đỏ": "#ef4444",
        "Hồng": "#f9a8d4", "Xanh navy": "#1e3a8a", "Xanh dương": "#3b82f6", "Nâu": "#92400e",
        "Be": "#e7d3b0", "Vàng": "#facc15", "Bạc": "#cbd5e1", "Vàng hồng": "#f0b8a0", "Bạch kim": "#e5e4e2"
    };
    return map[name] || "#cccccc";
}

/** Lay thong tin 1 san pham (theo id) tu XML thanh object */
function product_item(p)
{
    var pid = p.getAttribute("id");
    return {
        id: pid,
        category: p.getAttribute("category"),
        categoryName: get_text(p, "categoryName"),
        title: get_text(p, "title"),
        description: get_text(p, "description"),
        image: get_text(p, "image"),
        color: get_text(p, "color"),
        // diem trung binh tu reviews.xml, neu chua co thi lay diem goc trong products.xml
        rate: ratings[pid] != undefined ? ratings[pid].avg : parseFloat(get_text(p, "rate")),
        stock: parseInt(get_text(p, "stock")),
        price: parseFloat(get_text(p, "price")),
        discount: parseInt(get_text(p, "discount"))
    };
}

/**
 * Hien thi san pham dang luoi, loc theo dieu kien f (null = hien tat ca)
 */
function show_products(grid, f)
{
    grid = document.getElementById(grid);
    grid.innerHTML = "";
    var products = productsXml.getElementsByTagName("product");
    var count = 0;
    for(var i = 0; i < products.length; i++)
    {
        var item = product_item(products[i]);
        if(f != null && !f(item))
            continue;
        count++;
        grid.appendChild(create_card(item));
    }
    document.getElementById("pResult").innerHTML = "Tìm thấy <strong>" + count + "</strong> sản phẩm";
    if(count == 0)
        grid.innerHTML = '<p class="empty">Không có sản phẩm phù hợp.</p>';
}

function create_card(item)
{
    var finalPrice = (item.price * (100 - item.discount) / 100).toFixed(2);

    var card = document.createElement("article");
    card.className = "card";

    // khung anh: anh + the <span> sao trung binh chen len anh
    var thumb = document.createElement("div");
    thumb.className = "thumb";
    var img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title;
    thumb.appendChild(img);
    thumb.appendChild(create_star_span(item.id));
    if(item.discount > 0)
    {
        var sale = document.createElement("span");
        sale.className = "sale";
        sale.innerHTML = "-" + item.discount + "%";
        thumb.appendChild(sale);
    }
    card.appendChild(thumb);

    var info = document.createElement("div");
    info.className = "info";
    var h3 = document.createElement("h3");
    h3.textContent = item.title;
    info.appendChild(h3);
    var meta = document.createElement("p");
    meta.className = "meta";
    meta.innerHTML = '<span class="tag">' + item.categoryName + '</span> ' +
                     '<span class="dot" style="background:' + color_code(item.color) + '"></span>' + item.color;
    info.appendChild(meta);
    var price = document.createElement("p");
    price.className = "price";
    price.innerHTML = "$" + finalPrice + (item.discount > 0 ? "<del>$" + item.price.toFixed(2) + "</del>" : "");
    info.appendChild(price);
    var stock = document.createElement("p");
    stock.className = item.stock < 20 ? "stock low" : "stock";
    stock.innerHTML = "Kho: " + item.stock;
    info.appendChild(stock);
    card.appendChild(info);

    // 3 nut: moi nut mang data-action, data-id, data-variant (KHONG gan listener rieng)
    var btns = document.createElement("div");
    btns.className = "btns";
    btns.innerHTML =
        '<button type="button" class="b-add" data-action="add" data-id="' + item.id + '" data-variant="' + item.color + '">Thêm vào giỏ hàng</button>' +
        '<button type="button" class="b-quick" data-action="quick" data-id="' + item.id + '" data-variant="' + item.color + '">Xem nhanh</button>' +
        '<button type="button" class="b-rating" data-action="rating" data-id="' + item.id + '" data-variant="' + item.color + '">Rating Detail</button>';
    card.appendChild(btns);
    return card;
}

/* ======================================================
 * CAU 4: EVENT DELEGATION - 1 listener duy nhat tren container
 * ====================================================== */
function on_grid_click(e)
{
    // tim nut gan nhat co data-action (xu ly ca khi click vao phan tu con ben trong nut)
    var btn = e.target.closest("button[data-action]");
    if(btn == null || !this.contains(btn))
        return;
    var id = btn.dataset.id;            // data-id
    var variant = btn.dataset.variant;  // data-variant
    var action = btn.dataset.action;

    if(action == "add")
        add_to_cart(id, variant);
    else if(action == "quick")
        show_quick_view(id, variant);
    else if(action == "rating")
        show_rating_detail(id);
}

function find_product(id)
{
    var products = productsXml.getElementsByTagName("product");
    for(var i = 0; i < products.length; i++)
        if(products[i].getAttribute("id") == id)
            return product_item(products[i]);
    return null;
}

function add_to_cart(id, variant)
{
    cartState.add(id, variant);   // Cau 6: cap nhat state gio hang
    // lay dong gio hang vua them de hien thong bao
    var line = null;
    for(var i = 0; i < cartState.items.length; i++)
        if(cartState.items[i].id == id && cartState.items[i].variant == variant)
            line = cartState.items[i];
    show_toast("Đã thêm vào giỏ hàng", line);
}

function show_quick_view(id, variant)
{
    var p = find_product(id);
    var finalPrice = (p.price * (100 - p.discount) / 100).toFixed(2);
    document.getElementById("dlgBody").innerHTML =
        '<div class="qv"><img src="' + p.image + '" alt="">' +
        '<div><h3></h3><p class="meta"><span class="tag">' + p.categoryName + '</span> ' +
        '<span class="dot" style="background:' + color_code(variant) + '"></span>' + variant + '</p>' +
        '<p class="price">$' + finalPrice + '</p>' +
        '<p class="desc"></p>' +
        '<p class="meta">Mã sản phẩm: ' + p.id + ' · Còn ' + p.stock + ' sản phẩm</p></div></div>';
    var body = document.getElementById("dlgBody");
    body.getElementsByTagName("h3")[0].textContent = p.title;
    body.getElementsByClassName("desc")[0].textContent = p.description;
    document.getElementById("dlgInfo").showModal();
}

/** Rating Detail: danh sach khach hang da danh gia san pham */
function show_rating_detail(id)
{
    var p = find_product(id);
    var html = '<h3></h3>';
    var r = ratings[id];
    if(r == undefined)
        html += '<p class="empty">Sản phẩm này chưa có đánh giá.</p>';
    else
    {
        html += '<p class="avg">★ ' + r.avg.toFixed(1) + ' / 5 <small>(' + r.count + ' lượt đánh giá)</small></p><ul class="reviews">';
        for(var i = 0; i < r.list.length; i++)
        {
            var rv = r.list[i];
            var name = customers[rv.customerId] != undefined ? customers[rv.customerId] : rv.customerId;
            html += '<li><strong>' + name + '</strong> <span class="rs">' + "★".repeat(rv.rating) + "☆".repeat(5 - rv.rating) + '</span>' +
                    ' <small>' + rv.date + '</small><br>' + rv.comment + '</li>';
        }
        html += '</ul>';
    }
    var body = document.getElementById("dlgBody");
    body.innerHTML = html;
    body.getElementsByTagName("h3")[0].textContent = "Đánh giá: " + p.title;
    document.getElementById("dlgInfo").showModal();
}

var toastTimer = null;

/**
 * Thong bao dang the (toast) goc tren ben phai.
 * @param {*} msg - tieu de thong bao
 * @param {*} line - (tuy chon) dong gio hang vua them: hien anh, ten, mau, so luong + nut Xem gio hang
 */
function show_toast(msg, line)
{
    var t = document.getElementById("toast");
    var html = line ? '<img class="t-img" alt="">' : '<span class="t-ok">✓</span>';
    html += '<div class="t-text"><strong></strong><span class="t-name"></span><span class="t-sub"></span></div>';
    if(line)
        html += '<button type="button" class="t-view">Xem giỏ hàng</button>';
    html += '<i class="t-bar"></i>';
    t.innerHTML = html;
    t.getElementsByTagName("strong")[0].textContent = msg;
    if(line)
    {
        t.getElementsByTagName("img")[0].src = line.image;
        t.getElementsByClassName("t-name")[0].textContent = line.title;
        t.getElementsByClassName("t-sub")[0].textContent = "Màu: " + line.variant + " · Số lượng trong giỏ: " + line.qty;
    }
    t.className = "";
    void t.offsetWidth;          // khoi dong lai hieu ung
    t.className = "show";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { t.className = ""; }, 3500);
}

/** Bam "Xem giỏ hàng" tren thong bao: mo Mini-cart */
function init_toast()
{
    document.getElementById("toast").addEventListener("click", function(e)
    {
        if(e.target.closest(".t-view") == null)
            return;
        this.className = "";
        document.getElementById("miniCart").hidden = false;
    });
}
/* ======================================================
 * TIM KIEM (form HTML5)
 * ====================================================== */
function search_products(e)
{
    e.preventDefault();
    var form = document.getElementById("frmSearch");
    var numMin = document.getElementById("numMin");
    var numMax = document.getElementById("numMax");

    // kiem tra rang buoc cheo: gia thap nhat <= gia cao nhat
    if(parseFloat(numMin.value) > parseFloat(numMax.value))
    {
        numMax.setCustomValidity("Giá cao nhất phải lớn hơn hoặc bằng giá thấp nhất");
        numMax.reportValidity();
        numMax.oninput = function() { numMax.setCustomValidity(""); };
        return false;
    }
    numMax.setCustomValidity("");

    var keyword = form.keyword.value.trim().toLowerCase();
    var category = form.category.value;
    var min = parseFloat(numMin.value);
    var max = parseFloat(numMax.value);
    var color = form.color.value.trim().toLowerCase();
    var rating = parseFloat(form.rating.value);
    var stock = form.stock.value == "" ? 0 : parseInt(form.stock.value);
    var onlyDiscount = form.onlyDiscount.checked;

    show_products(gridId, function(item)
    {
        var finalPrice = item.price * (100 - item.discount) / 100;
        if(keyword != "" && item.title.toLowerCase().indexOf(keyword) == -1) return false;
        if(category != "all" && item.category != category) return false;
        if(finalPrice < min || finalPrice > max) return false;
        if(color != "" && item.color.toLowerCase().indexOf(color) == -1) return false;
        if(item.rate < rating) return false;
        if(item.stock < stock) return false;
        if(onlyDiscount && item.discount == 0) return false;
        return true;
    });
    return false;
}

/** Xoa loc: hien lai tat ca san pham */
function reset_search()
{
    document.getElementById("outRating").value = 0;
    setTimeout(function() { show_products(gridId, null); }, 0);
}


/** Mobile/Tablet: nut bam de mo/dong form tim kiem nang cao */
function init_filter()
{
    var btn = document.getElementById("btnFilter");
    btn.addEventListener("click", function()
    {
        var side = btn.parentNode;
        var open = side.classList.toggle("open");
        btn.setAttribute("aria-expanded", open);
    });
}