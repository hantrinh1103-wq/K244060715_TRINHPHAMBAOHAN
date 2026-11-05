/* ======================================================
 * CAU 6: QUAN LY STATE GIO HANG BANG DOI TUONG JS
 * ====================================================== */
var cartState = {
    items: [],   // moi phan tu: { id, variant, qty, title, price, image }

    /** Doc gio hang da luu (neu co) */
    load: function()
    {
        try { this.items = JSON.parse(localStorage.getItem("cartState")) || []; }
        catch(e) { this.items = []; }
    },

    save: function()
    {
        localStorage.setItem("cartState", JSON.stringify(this.items));
    },

    /** Them moi neu chua co, hoac tang so luong neu cung san pham + cung mau (variant) */
    add: function(id, variant)
    {
        for(var i = 0; i < this.items.length; i++)
        {
            if(this.items[i].id == id && this.items[i].variant == variant)
            {
                this.items[i].qty++;
                this.update();
                return;
            }
        }
        var p = find_product(id);
        this.items.push({
            id: id,
            variant: variant,
            qty: 1,
            title: p.title,
            image: p.image,
            price: Math.round(p.price * (100 - p.discount)) / 100   // gia sau giam
        });
        this.update();
    },

    changeQty: function(index, delta)
    {
        this.items[index].qty += delta;
        if(this.items[index].qty <= 0)
            this.items.splice(index, 1);
        this.update();
    },

    remove: function(index)
    {
        this.items.splice(index, 1);
        this.update();
    },

    clear: function()
    {
        this.items = [];
        this.update();
    },

    /** Tu dong tinh lai tong so luong */
    count: function()
    {
        var n = 0;
        for(var i = 0; i < this.items.length; i++)
            n += this.items[i].qty;
        return n;
    },

    /** Tu dong tinh lai tong tien */
    total: function()
    {
        var sum = 0;
        for(var i = 0; i < this.items.length; i++)
            sum += this.items[i].price * this.items[i].qty;
        return Math.round(sum * 100) / 100;
    },

    /** Moi lan state thay doi: luu lai + ve lai Mini-cart */
    update: function()
    {
        this.save();
        this.render();
    },

    /** Render bang Mini-cart (panel position:absolute, z-index cao de de len man hinh) */
    render: function()
    {
        document.getElementById("spCart").innerHTML = this.count();
        document.getElementById("mcTotal").innerHTML = "$" + this.total().toFixed(2);
        var body = document.getElementById("miniCartBody");
        body.innerHTML = "";
        if(this.items.length == 0)
        {
            body.innerHTML = '<p class="mc-empty">Giỏ hàng đang trống</p>';
            document.getElementById("btnCheckout").disabled = true;
            return;
        }
        document.getElementById("btnCheckout").disabled = false;

        var table = document.createElement("table");
        table.innerHTML = "<thead><tr><th>Sản phẩm</th><th>SL</th><th>Tiền</th><th></th></tr></thead>";
        var tbody = document.createElement("tbody");
        for(var i = 0; i < this.items.length; i++)
        {
            var it = this.items[i];
            var tr = document.createElement("tr");
            var tdName = document.createElement("td");
            var img = document.createElement("img");
            img.src = it.image;
            img.alt = "";
            var name = document.createElement("span");
            name.className = "mc-name";
            name.textContent = it.title;
            var variant = document.createElement("small");
            variant.textContent = "Màu: " + it.variant;
            tdName.appendChild(img);
            var wrap = document.createElement("div");
            wrap.appendChild(name);
            wrap.appendChild(variant);
            tdName.appendChild(wrap);

            var tdQty = document.createElement("td");
            tdQty.className = "mc-qty";
            tdQty.innerHTML = '<button type="button" data-action="dec" data-index="' + i + '">−</button>' +
                              '<span>' + it.qty + '</span>' +
                              '<button type="button" data-action="inc" data-index="' + i + '">+</button>';

            var tdMoney = document.createElement("td");
            tdMoney.innerHTML = "$" + (it.price * it.qty).toFixed(2);

            var tdDel = document.createElement("td");
            tdDel.innerHTML = '<button type="button" class="mc-del" data-action="del" data-index="' + i + '" title="Xóa">✕</button>';

            tr.appendChild(tdName);
            tr.appendChild(tdQty);
            tr.appendChild(tdMoney);
            tr.appendChild(tdDel);
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        body.appendChild(table);
    }
};

/** Khoi tao Mini-cart: 1 listener cho panel (event delegation), 1 cho nut mo/dong */
function init_cart()
{
    cartState.load();
    cartState.render();

    document.getElementById("lnkCart").addEventListener("click", function(e)
    {
        e.preventDefault();
        var panel = document.getElementById("miniCart");
        panel.hidden = !panel.hidden;
    });

    document.getElementById("miniCart").addEventListener("click", function(e)
    {
        var btn = e.target.closest("button[data-action]");
        if(btn == null)
            return;
        var action = btn.dataset.action;
        var index = parseInt(btn.dataset.index);
        if(action == "inc") cartState.changeQty(index, 1);
        else if(action == "dec") cartState.changeQty(index, -1);
        else if(action == "del") cartState.remove(index);
        else if(action == "close") this.hidden = true;
        else if(action == "checkout")
        {
            this.hidden = true;
            open_checkout();
        }
    });

    init_checkout();
}

/* ======================================================
 * CAU 7: MODULE THANH TOAN - REGEX + LOCALSTORAGE
 * ====================================================== */
var checkoutRules = {
    fullName: { regex: /^[A-Za-zÀ-ỹ\s]{2,50}$/, message: "Họ tên 2–50 ký tự, chỉ gồm chữ cái" },
    // SĐT Viet Nam: 0 hoac +84, dau so 3/5/7/8/9, tong 10 so
    phone:    { regex: /^(0|\+84)(3|5|7|8|9)\d{8}$/, message: "Số điện thoại Việt Nam không hợp lệ (vd: 0912345678 hoặc +84912345678)" },
    email:    { regex: /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/, message: "Email không hợp lệ (vd: ten@gmail.com)" },
    address:  { regex: /^.{5,100}$/, message: "Địa chỉ giao hàng 5–100 ký tự" }
};

/** Kiem tra 1 o nhap, hien thong bao loi ngay. Tra ve true/false */
function validate_field(input)
{
    var rule = checkoutRules[input.name];
    if(rule == undefined)
        return true;
    var ok = rule.regex.test(input.value.trim());
    var msg = document.getElementById("err_" + input.name);
    input.classList.toggle("ok", ok);
    input.classList.toggle("bad", !ok);
    msg.textContent = ok ? "" : rule.message;
    return ok;
}

function init_checkout()
{
    var form = document.getElementById("frmCheckout");
    // kiem tra ngay lap tuc khi go phim (keyup) va khi roi o nhap (blur -> focusout noi bot len form)
    form.addEventListener("keyup", function(e) { validate_field(e.target); });
    form.addEventListener("focusout", function(e) { validate_field(e.target); });
    form.addEventListener("submit", submit_checkout);
    document.getElementById("btnCancelCheckout").addEventListener("click", function()
    {
        document.getElementById("dlgCheckout").close();
    });
}

function open_checkout()
{
    var form = document.getElementById("frmCheckout");
    form.reset();
    var inputs = form.querySelectorAll("input[name]");
    for(var i = 0; i < inputs.length; i++)
        inputs[i].classList.remove("ok", "bad");
    var errs = form.querySelectorAll(".err");
    for(var i = 0; i < errs.length; i++)
        errs[i].textContent = "";
    document.getElementById("ckTotal").innerHTML = "$" + cartState.total().toFixed(2);
    document.getElementById("dlgCheckout").showModal();
}

/** Gui API thanh toan (gia lap): tao don hang va luu vao localStorage */
function submit_checkout(e)
{
    e.preventDefault();
    var form = e.target;
    var valid = true;
    var inputs = form.querySelectorAll("input[name]");
    for(var i = 0; i < inputs.length; i++)
        if(!validate_field(inputs[i]))
            valid = false;
    if(!valid)
    {
        form.querySelector("input.bad").focus();
        return;
    }

    var orders = JSON.parse(localStorage.getItem("orders")) || [];
    var details = [];
    for(var i = 0; i < cartState.items.length; i++)
    {
        var it = cartState.items[i];
        details.push({
            productId: it.id,
            productName: it.title,
            variant: it.variant,
            quantity: it.qty,
            unitPrice: it.price,
            amount: Math.round(it.price * it.qty * 100) / 100
        });
    }
    var order = {
        id: "WEB" + ("000" + (orders.length + 1)).slice(-3),
        orderDate: new Date().toISOString().slice(0, 19),
        employeeId: "WEB",
        customerId: "",
        customerName: form.fullName.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        address: form.address.value.trim(),
        paymentMethod: form.payment.value,
        status: "pending",
        details: details,
        totalAmount: cartState.total()
    };
    orders.push(order);
    localStorage.setItem("orders", JSON.stringify(orders));   // luu gia lap

    cartState.clear();
    document.getElementById("dlgCheckout").close();
    show_toast("Thanh toán thành công! Mã đơn hàng: " + order.id);
}
