/* Trang Lien he: kiem tra form bang Regex, luu loi nhan vao localStorage (gia lap) */
var contactRules = {
    fullName: { regex: /^[A-Za-zÀ-ỹ\s]{2,50}$/, message: "Họ tên 2–50 ký tự, chỉ gồm chữ cái" },
    phone:    { regex: /^(0|\+84)(3|5|7|8|9)\d{8}$/, message: "Số điện thoại Việt Nam không hợp lệ (vd: 0912345678)" },
    email:    { regex: /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/, message: "Email không hợp lệ (vd: ten@gmail.com)" },
    message:  { regex: /^[\s\S]{10,500}$/, message: "Nội dung từ 10 đến 500 ký tự" }
};

function validate_contact_field(input)
{
    var rule = contactRules[input.name];
    if(rule == undefined)
        return true;
    var ok = rule.regex.test(input.value.trim());
    input.classList.toggle("ok", ok);
    input.classList.toggle("bad", !ok);
    document.getElementById("err_" + input.name).textContent = ok ? "" : rule.message;
    return ok;
}

var form = document.getElementById("frmContact");
// kiem tra ngay khi go phim (keyup) va khi roi o nhap (focusout = blur noi bot)
form.addEventListener("keyup", function(e) { validate_contact_field(e.target); });
form.addEventListener("focusout", function(e) { validate_contact_field(e.target); });

form.addEventListener("submit", function(e)
{
    e.preventDefault();
    var fields = form.querySelectorAll("input[name], textarea[name]");
    var valid = true;
    for(var i = 0; i < fields.length; i++)
        if(!validate_contact_field(fields[i]))
            valid = false;
    var sent = document.getElementById("pSent");
    if(!valid)
    {
        sent.className = "sent bad";
        sent.textContent = "Vui lòng kiểm tra lại các ô báo đỏ.";
        form.querySelector(".bad").focus();
        return;
    }
    var list = JSON.parse(localStorage.getItem("contacts")) || [];
    list.push({
        id: "LH" + ("000" + (list.length + 1)).slice(-3),
        date: new Date().toISOString().slice(0, 19),
        fullName: form.fullName.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        topic: form.topic.value,
        message: form.message.value.trim()
    });
    localStorage.setItem("contacts", JSON.stringify(list));
    sent.className = "sent";
    sent.textContent = "✔ Cảm ơn bạn! Mini Shop đã nhận được lời nhắn và sẽ phản hồi sớm.";
    form.reset();
    var all = form.querySelectorAll(".ok, .bad");
    for(var i = 0; i < all.length; i++)
        all[i].classList.remove("ok", "bad");
});
