# Balans Bul — Yapılacaklar

## CI derleme

- [x] **GitHub Actions yerel native test derlemeleri** — “GitHub Actions iş akışı, Android debug APK ile iOS Simulator derlemesini üretip indirilebilir artifact olarak saklar.” `.github/workflows/native-build.yml`, push/PR ve manuel çalıştırmada iki imzasız test derlemesini GitHub Actions artifact'i olarak saklar.

## Kamera önizlemesi ve ölçüm hazırlığı

- [x] **Kamera önizlemesi ve kalibrasyon** — “Telefon kamerasına erişim ve canlı görüntü önizlemesi”; “Dönen cismin kadraj içinde konumlandırılması için hizalama ve çekim yönergeleri”; “Ölçüm öncesi kısa kamera ve ölçek kalibrasyon akışı”. Kamera izni, canlı önizleme, kullanıcı dokunuşuyla mil merkezi seçimi ve isteğe bağlı rotor çapı girişi eklendi.

## Görsel ölçüm

- [ ] **Görüntüden gerçek balans noktası çıkarımı** — “Görüntüde dönen cismin ve referans merkezinin tespiti”; “Hareketin kareler boyunca izlenerek dönüş ekseni ile sapmanın analiz edilmesi”; “Tespit edilen balans noktasının canlı kamera görüntüsü üzerinde işaretlenmesi”; “Dengesizlik yönü ve göreli şiddetinin sade bir sonuç göstergesiyle sunulması”. Mevcut sürüm yeşil bir referans işaretini ve kullanıcının elle işaretlediği merkezi izleyerek görünür radyal yörünge kaçıklığını hesaplıyor ve optik sapma yönünü işaretliyor. Kamera görüntüsü tek başına gizli kütle dağılımını kanıtlamadığından gerçek ağır tarafı, balans ağırlığı veya endüstriyel düzeltme noktası çıkarımı tamamlanmış değildir; uygulama sonucu da bu şekilde sunmuyor.

## Uyarılar ve sonuç akışı

- [x] **Ölçüm durumu, uyarılar ve tekrar** — “Yetersiz ışık, aşırı titreşim veya uygun olmayan kadraj için gerçek zamanlı uyarılar”; “Ölçümü yeniden başlatma ve son sonucu özet ekranında görüntüleme”. Düşük ışık, görünmeyen referans, uygunsuz kadraj ve yüksek işaret-yörünge saçılımı için canlı uyarılar; durdurma, tekrar başlatma ve özet ekranı eklendi. Yüksek saçılım uyarısı doğrudan ivme sensörüyle ölçülen titreşim değil, optik kararsızlık göstergesidir.
