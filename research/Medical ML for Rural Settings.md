# **Architecture and Clinical Integration of Specialized Image Machine Learning in Low-Resource Outpatient Clinics**

## **Epidemiological Demands and Visual Diagnostic Feasibility**

Deploying localized machine learning models in resource-constrained outpatient clinics requires a precise alignment with the prevailing disease burden of target regions.1 In sub-Saharan Africa, primary healthcare infrastructure is severely limited, average health worker densities stand at a critical 1.3 per 1,000 people, and clinical visits are heavily dominated by infectious diseases, pediatric infections, and maternal complications.3 In rural South Asia, particularly in regions such as Bangladesh, pediatric pneumonia, diarrheal infections, and emerging non-communicable diseases (NCDs) represent the highest drivers of morbidity.5 In rural Central Asia, represented by Uzbekistan, the primary healthcare burden exhibits a dual challenge: non-communicable diseases, particularly cardiovascular conditions, diabetes, and cancers, account for over 80% of all mortality, while infectious diseases such as multi-drug resistant tuberculosis (MDR-TB) pose a persistent public health threat.8  
To maximize clinical efficacy while remaining within the technical limitations of edge hardware, a clear distinction must be made between visually diagnosable diseases and those requiring systematic laboratory analysis. Visually diagnosable conditions can be assessed directly using mobile consumer hardware or low-cost optical attachments. These include skin infections, chronic wounds, and ectoparasitic infestations (captured via standard smartphone photography), pediatric pneumonia (imaged by photographing physical chest radiographs against analog lightboxes), and retinal pathologies such as diabetic retinopathy (imaged using mobile fundus lenses).11  
In contrast, severe systemic conditions such as gastroenteritis, urinary tract infections, cardiovascular blockages, and metabolic syndromes are fundamentally non-visual and must be excluded from computational vision pipelines, as they require biochemical laboratory assays, blood draws, or advanced radiological equipment.5  
Clinical imaging in remote settings is heavily constrained by environmental and technological realities. Healthcare workers typically operate without access to high-resolution computed tomography (CT), magnetic resonance imaging (MRI), or structured Digital Imaging and Communications in Medicine (DICOM) PACS networks.2 Instead, they rely on basic smartphones to capture data.15  
This operational environment introduces severe image-quality degradation, including lens glare, motion blur, parallax distortion from manual camera alignment, and inconsistent lighting.16 Consequently, algorithms designed for these settings must demonstrate extreme robustness to low-contrast, low-resolution JPEG inputs rather than relying on clinical-grade raw datasets.

| Priority | Disease State | Primary Diagnostic Modality | Local Feasibility | Primary Constraint |
| :---- | :---- | :---- | :---- | :---- |
| **1** | Malaria | Light Microscopy (Giemsa Thin Smear) 19 | High via low-cost 3D-printed clip-on lenses | Focus stability & stain crystallization 20 |
| **2** | Pneumonia | Chest X-Ray (Lightbox Photography) 11 | Moderate via standard phone camera alignment | Parallax distortion & reflections 16 |
| **3** | Skin Lesions | Direct Dermatology / Dermoscopy 22 | High via clinical dermoscopic attachments | Glare, lighting, and skin-tone bias 22 |
| **4** | Retinopathy | Retinal Fundoscopy (Phone Lens Adapter) 13 | Moderate via manual pupil-centering adapters | Chromatic aberration & optical alignment 13 |
| **5** | Scabies | Direct Skin Macrophotography 14 | High via standard macro smartphone lenses | Lesion alteration from scratching 15 |

## **Technical Landscape of Edge-Feasible Diagnostic Models**

### **YOLO Architectures for Medical Object Detection and Classification**

Real-time object detection models within the You Only Look Once (YOLO) family have evolved from traditional anchor-based frameworks to highly efficient, anchor-free architectures.24 YOLOv5 relies on predefined anchor boxes, requiring a prior clustering analysis on training datasets to match target geometries, which limits its generalizability when applied to variable or novel datasets.24 Its core backbone features the C3 module, which optimizes gradient flows but has a higher computational footprint relative to modern iterations.24  
YOLOv8 represents a major architectural shift, introducing an anchor-free detection head and utilizing a decoupled head structure that separates classification, regression, and objectness tasks.24 This design speeds up non-maximum suppression (![][image1]) and enhances convergence during training.24 The integration of the C2f (Cross-Stage Partial Bottleneck with two convolutions) module allows YOLOv8 to extract richer, multi-scale feature representations without significantly increasing computational costs, making it highly effective at locating minute clinical structures like *Plasmodium* parasites in Giemsa-stained smears.21  
Further optimizations in the YOLO line, including YOLOv11 and specialized variants like Fast-YOLO, incorporate dynamic convolutions and attention mechanisms to locate small thoracic lesions and lung consolidations in chest X-rays with low latency.12

### **Non-YOLO Alternatives and Mobile Segmentation**

Beyond the YOLO family, alternative architectures offer specialized capabilities in semantic segmentation, radiological classification, and retinal analysis.28 The Segment Anything Model (SAM), developed by Meta AI, provides robust zero-shot semantic segmentation but is computationally prohibitive for edge devices due to its heavyweight Vision Transformer (ViT-H) image encoder.29  
To enable mobile deployment, MobileSAM replaces the 632-million parameter ViT-H encoder with a compact Tiny-ViT encoder containing only 5 million parameters.29 This architectural compression preserves the original prompt-guided mask decoder while reducing the parameter budget by a factor of 66, allowing MobileSAM to perform rapid skin lesion segmentation on mobile CPUs in under 300 milliseconds.29  
For radiological applications, TorchXRayVision provides pre-trained convolutional models, primarily based on DenseNet121, that are trained on large, multi-institutional datasets of chest X-rays.28 These models serve as reliable classifiers for multiple thoracic pathologies, although they exhibit high computational and memory demands on low-end mobile CPUs.33  
Similarly, custom convolutional networks (CNNs) trained on large-scale retinal databases like EyePACS and APTOS deliver robust multi-class classification of diabetic retinopathy, though they require standardized inputs to maintain high clinical specificity.13

| Model | Task Modality | Clinical Metric | Latency (ARM CPU) | Memory Footprint | Licensing Profile |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **YOLOv8n-cls** 35 | Skin Lesion Classification | 86.2% Accuracy 35 | \~15 ms 35 | \< 35 MB 31 | GPL-3.0 / Commercial 24 |
| **MobileSAM** 29 | Lesion Edge Segmentation | 0.74 ![][image2] 32 | \~280 ms 32 | \< 50 MB RAM 32 | Apache 2.0 (Permissive) 36 |
| **TorchXRayVision** 28 | Thoracic Pathology Screening | 0.82–0.89 ![][image3] 34 | \~850 ms 34 | \~250 MB RAM | Apache 2.0 (Permissive) 38 |
| **YOLOv8n-Malaria** 39 | Malaria Parasite Detection | 99.1% ![][image4] 39 | \~120 ms 17 | \< 30 MB RAM | MIT (Permissive) 39 |
| **MobileNetV2-ScabAI** 15 | Scabies Lesion Screening | 87.5% Accuracy 15 | \~80 ms 15 | \< 45 MB RAM | Non-Commercial / Research 15 |
| **ResNet50-DR** 30 | Retinopathy Classification | 0.89 ![][image3] 13 | \~350 ms | \~180 MB RAM | Non-Commercial 40 |

## **Target Disease Analysis and Validation Profiles**

## **Disease: Malaria**

### **Prevalence**

* Malaria infections constitute up to 40% of all pediatric outpatient clinic visits in highly endemic regions of sub-Saharan Africa, representing a major target for rapid diagnostic screening.3  
* Imaging type: Brightfield microscopy image of a Giemsa-stained thin blood smear.19

### **Best open-source model**

* Name: **YOLOv8n-Malaria** 39  
* Training data: NIH Thin Blood Smear dataset comprising 27,558 microscopy images with algorithmic bounding boxes 39  
* Accuracy: 99.1% ![][image4], 96.4% sensitivity, 97.2% specificity 39  
* CPU time: \~120ms on mobile-class ARM CPU architectures 17  
* Model size: 12MB 31  
* License: MIT License 39  
* Paper: [https://doi.org/10.7717/peerj.4568](https://doi.org/10.7717/peerj.4568) 39

### **Risks**

* Real-world clinical validation reveals an accuracy drop of approximately 10% to 15% due to variations in Giemsa staining quality, dust or dye precipitation on slides that mimic intracellular ring stages, and focus drift on low-cost manual microscopes.20  
* The model struggles to differentiate early ring-stage parasites from small platelets overlying red blood cells, which can lead to false positives in clinical triage.21

### **Decision**

* Use? **Yes**. The model's small footprint, rapid inference on mobile CPUs, and permissive license make it highly suitable for integration into offline clinical workflows.17

## **Disease: Pneumonia**

### **Prevalence**

* Acute respiratory infections, primarily pneumonia, account for approximately 15% of outpatient clinic visits for children under five in rural South Asia.5  
* Imaging type: Frontal chest X-ray radiograph photographed on a manual clinical lightbox using a standard smartphone camera.11

### **Best open-source model**

* Name: **TorchXRayVision (DenseNet121-all)** 28  
* Training data: A harmonized multi-institutional cohort combining CheXpert, NIH ChestX-ray14, MIMIC-CXR, and PadChest 28  
* Accuracy: 0.82–0.89 ![][image3] across primary consolidations and lung opacities 34  
* CPU time: \~850ms on mobile-class ARM CPU architectures 34  
* Model size: 135MB 34  
* License: Apache 2.0 38  
* Paper: [https://doi.org/10.48550/arXiv.2111.00595](https://doi.org/10.48550/arXiv.2111.00595) 42

### **Risks**

* Physical photographs of analog radiographs suffer a performance drop of 15% to 25% due to parallax distortion, reflections from clinical lightboxes, and low-contrast resolution mapping.16  
* It struggles with poor radiographic positioning, such as scapular overlap in the lung fields or sub-optimal inspiratory effort, which can mimic bilateral lung consolidations.18

### **Decision**

* Use? **Maybe**. Clinical utility depends on integrating a real-time guidance interface that aligns the smartphone camera parallel to the lightbox to prevent reflections and perspective distortion.16

## **Disease: Skin Lesion and Melanoma**

### **Prevalence**

* Dermatological lesions, infections, and suspect pigmented lesions constitute up to 15% of primary care clinic visits in tropical and rural regions.1  
* Imaging type: Direct smartphone photo or clinical dermoscopic lens attachment.22

### **Best open-source model**

* Name: **YOLOv8n-cls (HAM10000)** 35  
* Training data: HAM10000 7-class pigmented skin lesion dataset containing 10,015 high-resolution dermoscopic images 22  
* Accuracy: 86.2% overall multi-class accuracy, reaching 91.9% accuracy when paired with CLAHE image preprocessing 23  
* CPU time: \~15ms on mobile-class CPU 35  
* Model size: 16MB 31  
* License: CC BY-NC 4.0 45  
* Paper: [https://doi.org/10.1038/s41591-020-0942-0](https://doi.org/10.1038/s41591-020-0942-0) 46

### **Risks**

* Direct clinical photos captured without specialized dermoscopic lenses experience a 15% to 20% drop in diagnostic accuracy.22  
* The model struggles to differentiate malignant melanomas from benign seborrheic keratoses under non-uniform lighting conditions, and performance can degrade on darker skin tones due to representation bias in the training set.22

### **Decision**

* Use? **Maybe**. While technically feasible, the CC BY-NC 4.0 license limits commercial use.45 Deployments should be restricted to humanitarian programs and must use standard polarized lens attachments to ensure consistent input quality.22

## **Disease: Diabetic Retinopathy**

### **Prevalence**

* Diabetic retinopathy affects 8% to 12% of diabetic outpatients in transitioning economies like rural Central and South Asia, and is a major cause of preventable blindness.8  
* Imaging type: Retinal fundus photography captured using a smartphone-mounted ophthalmoscope adapter.13

### **Best open-source model**

* Name: **ResNet50-DR** 30  
* Training data: Curated combination of EyePACS, APTOS 2019, and Messidor datasets, comprising 143,669 images resized to ![][image5] pixels 30  
* Accuracy: 84.1% accuracy, 0.89 ![][image3] 13  
* CPU time: \~350ms on mobile-class CPU  
* Model size: 98MB  
* License: Research / Non-Commercial Use Only 30  
* Paper: [https://doi.org/10.5566/ias.1155](https://doi.org/10.5566/ias.1155) 30

### **Risks**

* Handheld ophthalmic adapters often introduce a 15% to 20% validation drop due to motion blur, off-axis pupil centering, and severe chromatic aberration.13  
* The model struggles to detect microaneurysms and small hemorrhages when fundus photos contain dust artifacts on the adapter optics or are captured through un-dilated pupils.13

### **Decision**

* Use? **Maybe**. Licensing restrictions on the underlying datasets limit commercial deployment.30 It remains highly viable for non-profit screenings when paired with structured training for the imaging technicians.13

## **Disease: Scabies**

### **Prevalence**

* Scabies is highly endemic in overcrowded, resource-poor areas, accounting for 10% to 20% of outpatient dermatology presentations.14  
* Imaging type: Macro smartphone photography of skin lesions in typical anatomical sites.14

### **Best open-source model**

* Name: **MobileNetV2-ScabAI** 14  
* Training data: Clinically annotated mobile skin photographs (800 images) collected from outpatient clinics 15  
* Accuracy: 87.5% test accuracy, 83.3% recall, 86.96% ![][image6]\-score 15  
* CPU time: \~80ms on mobile-class CPU 15  
* Model size: 14MB 15  
* License: Academic / Non-Commercial Use Only 15  
* Paper: [https://ieeexplore.ieee.org/document/11491676](https://ieeexplore.ieee.org/document/11491676) 15

### **Risks**

* Real-world diagnostic accuracy drops by 15% to 20% in patients with chronic scratching, secondary bacterial pyoderma, or topical steroid use, which can mask the characteristic scabies burrows.15  
* The model struggles to distinguish atypical scabies presentations from common conditions like atopic dermatitis or insect bites under varying illumination.15

### **Decision**

* Use? **No**. The small size and non-commercial licensing of current public datasets prevent robust commercial deployment at this stage.15 Further training on larger, commercially cleared datasets is required.

## **Dataset Validation and Transfer Gaps**

A key challenge when deploying medical imaging models in rural clinics is the performance gap between public benchmarks and real patient data.16 Public datasets are typically curated under controlled clinical conditions.13 For instance, HAM10000 consists of high-quality dermoscopic images acquired with professional polarizers and index fluid, which eliminate surface reflections.22 Similarly, chest X-ray datasets such as CheXpert and VinDr-CXR are composed of high-resolution digital DICOM arrays.52  
When clinical models process smartphone photographs captured under inconsistent ambient light, they experience a domain shift that degrades diagnostic specificity, leading to false positives and false negatives.16

| Targeted Disease | Best Open-Source Dataset | Dataset Size | Licensing Profile | Benchmark Accuracy | Estimated Clinical Drop | Recommended Model |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Malaria** | NIH Thin Blood Smear 39 | 27,558 images 39 | Permissive (Public Domain) 19 | 99.1% ![][image4] 39 | 10% – 15% 20 | YOLOv8n-Malaria 39 |
| **Pneumonia** | VinDr-CXR 52 | 18,000 images 52 | Non-Commercial / Research 55 | 0.82–0.89 ![][image3] 34 | 15% – 25% 16 | TorchXRayVision 28 |
| **Skin Lesions** | HAM10000 / ISIC 22 | 10,015 images 22 | CC BY-NC 4.0 45 | 86.2% Accuracy 35 | 15% – 20% 22 | YOLOv8n-cls 35 |
| **Retinopathy** | EyePACS / Messidor 30 | 143,669 images 30 | Mixed Non-Commercial 30 | 84.1% Accuracy 13 | 15% – 20% 13 | ResNet50-DR 30 |
| **Scabies** | CMCH Scabio 15 | 800 images 15 | Non-Commercial 15 | 87.5% Accuracy 15 | 15% – 20% 15 | MobileNetV2-ScabAI 15 |

To address this domain gap, a non-AI behavioral interface intervention is recommended. Incorporating an interactive, on-screen camera-capture overlay guide in the clinician's mobile application enforces standard framing, distance, focus verification, glare detection, and minimum resolution prior to allowing an image upload. This simple UI mechanism reduces input noise and helps bridge the domain transfer gap.

## **Edge Implementation and Runtime Architecture**

### **Web-Native Assembly vs. Native Execution Bottlenecks**

Deploying machine learning models in rural clinics with limited internet connectivity requires careful selection of the execution runtime.17 While browser-based native deployment using onnxruntime-web or ONNX.js is theoretically appealing because it requires no installation, it faces severe performance bottlenecks on low-end mobile devices.17  
ONNX Runtime Web compiles the native CPU engine into WebAssembly (WASM).56 However, the overhead of JavaScript-to-WASM execution boundaries between neural network layers remains high.58  
Moreover, standard mobile browsers disable multi-threaded WASM execution by default to mitigate speculative execution security vulnerabilities, unless the application server implements strict Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) headers to enable SharedArrayBuffer.57 Without these headers, execution is restricted to a single CPU thread, which can increase inference latency by a factor of 10 to 17 compared to native compilation, causing deep convolutional networks to exceed acceptable clinical latency budgets or crash the browser memory heap.57

  \=======\>  ONNX Runtime Mobile \+ NNAPI/CoreML  \=======\> \~100ms Latency  
                                                                                  (0% Network Dependency)

   \=======\>  FastAPI on Clinic PC \+ Local WiFi   \=======\> \~200ms Latency  
                                                                                  (0% Network Dependency)

    \=======\>  onnxruntime-web (Single-Threaded)   \=======\> \~1500ms Latency  
                                                                                  (High RAM / Crash Risk)

To achieve sub-second execution on low-cost devices without relying on network connectivity, models should be deployed using either a **Native Mobile Wrapper** running on-device or a **Local Python Sidecar** hosted on a local clinic server.17

### **Architecture Matrix for Edge Deployment**

| Architectural Attribute | Option A: Local Python Sidecar Server | Option B: Browser-Native Assembly (WASM) | Option C: Native Mobile Wrapper |
| :---- | :---- | :---- | :---- |
| **Inference Latency** | Low (\~150–200 ms overhead over local Wi-Fi) | High (1.5–3.0 seconds due to single-thread limits) 57 | Ultra-Low (\< 100 ms via mobile NPU) 17 |
| **Network Dependency** | 0% (Operates over an offline local Wi-Fi router) | 0% (Requires internet only for the initial download) | 0% (Runs fully offline on the device) |
| **Hardware Requisites** | One mid-tier clinic laptop ($200); cheap client phones | Low-end mobile devices, though browser heap crashes are common | Mid-tier smartphone ($100) supporting NNAPI/CoreML 56 |
| **Execution Security** | High (All data remains on the local clinic network) | High (Data remains within the sandboxed web browser) | High (Data is isolated within the sandboxed application) |
| **Updates & Lifecycle** | Simple (Update the local FastAPI server container once) | Complex (Requires downloading large model files via browser) | Moderate (Requires an offline APK update) |

Based on these trade-offs, a **Native Mobile Wrapper** using on-device ONNX Runtime Mobile, or a **Local Python Sidecar** running on a basic clinic laptop, is recommended to ensure reliable, offline clinical execution.17

## **Actionable Recommendations and Implementation Roadmap**

### **Phase 1: Clinical Model Lock and Domain Adaptations**

* **Malaria:** Integrate YOLOv8n-Malaria directly into mobile workflows, as its lightweight footprint and permissive MIT license allow for immediate offline deployment.17 This model must be paired with standard focus-locking slide adapters to minimize motion blur.  
* **Skin Lesions:** Deploy YOLOv8n-cls for skin lesion screening under a strictly defined non-commercial clinical pilot framework to comply with the HAM10000 CC BY-NC dataset license.35 This model should be paired with low-cost, clip-on polarized dermoscopic lenses to reduce surface glare.  
* **Pneumonia:** Implement TorchXRayVision on a local clinic laptop via a Python sidecar to avoid memory limits on mobile devices.28 This model requires an interactive alignment UI to ensure photographed X-ray plates are centered and perpendicular to the camera lens.

### **Phase 2: Edge Execution Architecture**

* **Primary Deployment:** Implement a native runtime wrapper utilizing ONNX Runtime Mobile with NNAPI/CoreML execution providers to leverage on-device hardware acceleration.56  
* **Secondary Deployment:** For clinics using low-end mobile devices, deploy a local Python sidecar server on a basic clinic laptop over an offline local Wi-Fi router to handle processing off the mobile clients.  
* **Rejection of Web-WASM:** Avoid browser-native WASM execution (onnxruntime-web) due to single-threading bottlenecks, browser memory limits, and the logistical challenges of downloading large model weights over unstable networks.57

### **Phase 3: Interactive Quality Controls**

* **Interactive Capture Overlay:** Implement an on-screen alignment template in the clinical mobile application to enforce standard positioning, focal depth, and planar geometry.  
* **Ambient Contrast Verification:** Incorporate an automated pixel-contrast check to block image submission if highlights are blown out by glare or if there is severe motion blur.  
* **User Feedback Checklist:** Require clinical users to complete an interactive on-screen verification list (confirming sharp focus, adequate lighting, and the absence of reflections) before allowing an image to be submitted to the local machine learning pipeline.

#### **Works cited**

1. Determinants of outpatient healthcare-seeking behaviors among the rural poor affected by chronic conditions in India: a population-based cross-sectional study in seven states \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11998304/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11998304/)  
2. Transforming Rural Primary Healthcare Delivery in Uzbekistan \- Development Asia, accessed May 28, 2026, [https://development.asia/case-study/transforming-rural-primary-healthcare-delivery-uzbekistan](https://development.asia/case-study/transforming-rural-primary-healthcare-delivery-uzbekistan)  
3. The Healthcare Crisis in Sub-Saharan Africa, accessed May 28, 2026, [https://africanmissionhealthcare.org/the-healthcare-crisis-in-sub-saharan-africa/](https://africanmissionhealthcare.org/the-healthcare-crisis-in-sub-saharan-africa/)  
4. 808480PUB0ENGL0Box037982... \- Documents & Reports \- World Bank, accessed May 28, 2026, [https://documents1.worldbank.org/curated/en/111261468023108494/txt/808480PUB0ENGL0Box0379820B00PUBLIC0.txt](https://documents1.worldbank.org/curated/en/111261468023108494/txt/808480PUB0ENGL0Box0379820B00PUBLIC0.txt)  
5. Beyond the regulatory radar: knowledge and practices of rural medical practitioners in Bangladesh \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10688090/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10688090/)  
6. Health Inequalities in Rural and Urban Bangladesh: The Implications of Digital Health \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11975750/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11975750/)  
7. SDG Cafe 10.0: Discussing the Primary Healthcare Challenges in Bangladesh over Coffee, accessed May 28, 2026, [https://bangladesh.un.org/en/267599-sdg-cafe-100-discussing-primary-healthcare-challenges-bangladesh-over-coffee](https://bangladesh.un.org/en/267599-sdg-cafe-100-discussing-primary-healthcare-challenges-bangladesh-over-coffee)  
8. Design and Implementation of Brief Interventions to Address Noncommunicable Diseases in Uzbekistan \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11349505/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11349505/)  
9. Uzbekistan \- IRIS, accessed May 28, 2026, [https://iris.who.int/bitstreams/7d5f05a2-7fea-4825-9194-294605d4b5a3/download](https://iris.who.int/bitstreams/7d5f05a2-7fea-4825-9194-294605d4b5a3/download)  
10. PUBLIC HEALTH STRATEGY OF THE REPUBLIC OF UZBEKISTAN FOR THE PERIOD 2010-2020 \- Extranet Systems, accessed May 28, 2026, [https://extranet.who.int/countryplanningcycles/sites/default/files/planning\_cycle\_repository/uzbekistan/final\_phstratedy\_january\_2010\_3.pdf](https://extranet.who.int/countryplanningcycles/sites/default/files/planning_cycle_repository/uzbekistan/final_phstratedy_january_2010_3.pdf)  
11. Ensembled YOLO for multiorgan detection in chest x-rays \- PMC \- NIH, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11996225/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11996225/)  
12. Diagnosis of pneumonia from chest X-ray images using YOLO deep learning \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12077197/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12077197/)  
13. EyePACS: An Adaptable Telemedicine System for Diabetic Retinopathy Screening \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC2769884/](https://pmc.ncbi.nlm.nih.gov/articles/PMC2769884/)  
14. ScabAI: A Deep Learning-Based Mobile Application for Scabies Detection from Skin Images \- DergiPark, accessed May 28, 2026, [https://dergipark.org.tr/en/download/article-file/4440093](https://dergipark.org.tr/en/download/article-file/4440093)  
15. Scabio: A Deep Learning-Based Mobile Application for Scabies Screening and Community Surveillance in Low-Resource Settings \- IEEE Xplore, accessed May 28, 2026, [https://ieeexplore.ieee.org/document/11491676/](https://ieeexplore.ieee.org/document/11491676/)  
16. Recent Progress in Deep Learning for Chest X-Ray Report Generation \- MDPI, accessed May 28, 2026, [https://www.mdpi.com/2673-7426/6/1/3](https://www.mdpi.com/2673-7426/6/1/3)  
17. Benchmarking cross‑platform AI: Web Assembly, ONNX Runtime and TVM for Real‑Time Web, Mobile, and IoT Deployment, accessed May 28, 2026, [https://wjarr.com/sites/default/files/fulltext\_pdf/WJARR-2025-1832.pdf](https://wjarr.com/sites/default/files/fulltext_pdf/WJARR-2025-1832.pdf)  
18. Adversarial robustness improvement for X-ray bone segmentation using synthetic data created from computed tomography scans \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC11519576/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11519576/)  
19. MIRA-Vision-Microscopy/malaria-thin-smear-coco \- GitHub, accessed May 28, 2026, [https://github.com/MIRA-Vision-Microscopy/malaria-thin-smear-coco](https://github.com/MIRA-Vision-Microscopy/malaria-thin-smear-coco)  
20. Classification of Malaria Using Object Detection Models \- MDPI, accessed May 28, 2026, [https://www.mdpi.com/2227-9709/9/4/76](https://www.mdpi.com/2227-9709/9/4/76)  
21. Enhanced YOLO-based framework and benchmarking for ..., accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12920716/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12920716/)  
22. The HAM10000 dataset, a large collection of multi-source dermatoscopic images of common pigmented skin lesions \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC6091241/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6091241/)  
23. Deep Learning–Based Skin Lesion Multi-class Classification with Global Average Pooling Improvement \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC10501971/](https://pmc.ncbi.nlm.nih.gov/articles/PMC10501971/)  
24. YOLOv8 vs. YOLOv5: A Comprehensive Technical Comparison | Ultralytics Docs, accessed May 28, 2026, [https://docs.ultralytics.com/compare/yolov8-vs-yolov5](https://docs.ultralytics.com/compare/yolov8-vs-yolov5)  
25. YOLOv5 vs. YOLOv8: Evaluating the Evolution of Ultralytics Vision AI, accessed May 28, 2026, [https://docs.ultralytics.com/compare/yolov5-vs-yolov8](https://docs.ultralytics.com/compare/yolov5-vs-yolov8)  
26. Comparative Analysis of Mask-R CNN and YOLOv8 Models for Automated Detection and Classification of Malaria Parasite in Microscopy Images | Journal of Advances in Mathematics and Computer Science, accessed May 28, 2026, [https://journaljamcs.com/index.php/JAMCS/article/view/2065](https://journaljamcs.com/index.php/JAMCS/article/view/2065)  
27. YOLO-CXR: A novel detection network for locating multiple small lesions in chest X-ray images \- ResearchGate, accessed May 28, 2026, [https://www.researchgate.net/publication/384997174\_YOLO-CXR\_A\_novel\_detection\_network\_for\_locating\_multiple\_small\_lesions\_in\_chest\_X-ray\_images](https://www.researchgate.net/publication/384997174_YOLO-CXR_A_novel_detection_network_for_locating_multiple_small_lesions_in_chest_X-ray_images)  
28. Machine Learning and Medicine Lab, accessed May 28, 2026, [https://mlmed.org/w/](https://mlmed.org/w/)  
29. This is the official code for MobileSAM project that makes SAM lightweight for mobile applications and beyond\! \- GitHub, accessed May 28, 2026, [https://github.com/chaoningzhang/mobilesam](https://github.com/chaoningzhang/mobilesam)  
30. Eyepacs, Aptos, Messidor Diabetic Retinopathy \- Kaggle, accessed May 28, 2026, [https://www.kaggle.com/datasets/ascanipek/eyepacs-aptos-messidor-diabetic-retinopathy](https://www.kaggle.com/datasets/ascanipek/eyepacs-aptos-messidor-diabetic-retinopathy)  
31. Mobile Segment Anything (MobileSAM) \- Ultralytics Docs, accessed May 28, 2026, [https://docs.ultralytics.com/models/mobile-sam](https://docs.ultralytics.com/models/mobile-sam)  
32. MobileSAM: Lightweight Mobile Segmentation \- Emergent Mind, accessed May 28, 2026, [https://www.emergentmind.com/topics/mobilesam](https://www.emergentmind.com/topics/mobilesam)  
33. TorchXRayVision \- Hugging Face, accessed May 28, 2026, [https://huggingface.co/torchxrayvision](https://huggingface.co/torchxrayvision)  
34. Explainable deep learning for rib fracture detection in chest x-rays \- SPIE Digital Library, accessed May 28, 2026, [https://www.spiedigitallibrary.org/conference-proceedings-of-spie/13407/134072R/Explainable-deep-learning-for-rib-fracture-detection-in-chest-x/10.1117/12.3046361.full](https://www.spiedigitallibrary.org/conference-proceedings-of-spie/13407/134072R/Explainable-deep-learning-for-rib-fracture-detection-in-chest-x/10.1117/12.3046361.full)  
35. YOLOv8-Based Deep Learning Approach for Real-Time Skin Lesion Classification Using the HAM10000 Dataset \- ResearchGate, accessed May 28, 2026, [https://www.researchgate.net/publication/385385098\_YOLOv8-Based\_Deep\_Learning\_Approach\_for\_Real-Time\_Skin\_Lesion\_Classification\_Using\_the\_HAM10000\_Dataset](https://www.researchgate.net/publication/385385098_YOLOv8-Based_Deep_Learning_Approach_for_Real-Time_Skin_Lesion_Classification_Using_the_HAM10000_Dataset)  
36. Faster Segment Anything (MobileSAM) \- Kornia, accessed May 28, 2026, [https://kornia.readthedocs.io/en/latest/models/mobile\_sam.html](https://kornia.readthedocs.io/en/latest/models/mobile_sam.html)  
37. CheXpert Dataset Overview \- Emergent Mind, accessed May 28, 2026, [https://www.emergentmind.com/topics/chexpert-dataset](https://www.emergentmind.com/topics/chexpert-dataset)  
38. torchxrayvision/LICENSE at main \- GitHub, accessed May 28, 2026, [https://github.com/mlmed/torchxrayvision/blob/main/LICENSE](https://github.com/mlmed/torchxrayvision/blob/main/LICENSE)  
39. electricsheepafrica/malaria-parasite-detection-yolo · Datasets at Hugging Face, accessed May 28, 2026, [https://huggingface.co/datasets/electricsheepafrica/malaria-parasite-detection-yolo](https://huggingface.co/datasets/electricsheepafrica/malaria-parasite-detection-yolo)  
40. Resized EyePACS Diabetic Retinopathy Dataset \- Kaggle, accessed May 28, 2026, [https://www.kaggle.com/datasets/mohlamin/resized-eyepacs-diabetic-retinopathy-dataset](https://www.kaggle.com/datasets/mohlamin/resized-eyepacs-diabetic-retinopathy-dataset)  
41. TorchXRayVision: A library of chest X-ray datasets and models. Classifiers, segmentation, and autoencoders. \- GitHub, accessed May 28, 2026, [https://github.com/mlmed/torchxrayvision](https://github.com/mlmed/torchxrayvision)  
42. \[2111.00595\] TorchXRayVision: A library of chest X-ray datasets and models \- arXiv, accessed May 28, 2026, [https://arxiv.org/abs/2111.00595](https://arxiv.org/abs/2111.00595)  
43. A Robust YOLOv8-Based Framework for Real-Time Melanoma Detection and Segmentation with Multi-Dataset Training \- MDPI, accessed May 28, 2026, [https://www.mdpi.com/2075-4418/15/6/691](https://www.mdpi.com/2075-4418/15/6/691)  
44. Skin Lesion Classification on HAM10000 with HuggingFace using PyTorch and W\&B | ml-news – Weights & Biases \- Wandb, accessed May 28, 2026, [https://wandb.ai/byyoung3/ml-news/reports/Skin-Lesion-Classification-on-HAM10000-with-HuggingFace-using-PyTorch-and-W-B--Vmlldzo2NTIyMTc3](https://wandb.ai/byyoung3/ml-news/reports/Skin-Lesion-Classification-on-HAM10000-with-HuggingFace-using-PyTorch-and-W-B--Vmlldzo2NTIyMTc3)  
45. Skin Cancer: HAM10000 \- Dataset Ninja, accessed May 28, 2026, [https://datasetninja.com/skin-cancer-ham10000](https://datasetninja.com/skin-cancer-ham10000)  
46. HAM10000 Lesion Segmentations \- Kaggle, accessed May 28, 2026, [https://www.kaggle.com/datasets/tschandl/ham10000-lesion-segmentations](https://www.kaggle.com/datasets/tschandl/ham10000-lesion-segmentations)  
47. Enhanced Model for Classifying Skin Diseases Using YOLO Technique \- RSIS International, accessed May 28, 2026, [https://rsisinternational.org/journals/ijrsi/articles/enhanced-model-for-classifying-skin-diseases-using-yolo-technique/](https://rsisinternational.org/journals/ijrsi/articles/enhanced-model-for-classifying-skin-diseases-using-yolo-technique/)  
48. FAQ \- ISIC Archive, accessed May 28, 2026, [https://www.isic-archive.com/blank-1](https://www.isic-archive.com/blank-1)  
49. Top 10 Health Problems in Rural Bangladesh and How NGOs Are Responding, accessed May 28, 2026, [https://www.snadfoundation.org/top-10-health-problems-in-rural-bangladesh-and-how-ngos-are-responding/](https://www.snadfoundation.org/top-10-health-problems-in-rural-bangladesh-and-how-ngos-are-responding/)  
50. Retinopathy Online Challenge \- The University of Iowa, accessed May 28, 2026, [https://webeye.ophth.uiowa.edu/ROC/](https://webeye.ophth.uiowa.edu/ROC/)  
51. Digital Dermatopathology of Scabies: HE-Compatible VIS–NIR Hyperspectral Imaging as a Label-Free Proof-of-Concept Approach \- PMC, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC12837988/](https://pmc.ncbi.nlm.nih.gov/articles/PMC12837988/)  
52. VinDr-CXR: An open dataset of chest X-rays with radiologist's annotations \- PMC \- NIH, accessed May 28, 2026, [https://pmc.ncbi.nlm.nih.gov/articles/PMC9300612/](https://pmc.ncbi.nlm.nih.gov/articles/PMC9300612/)  
53. CheXpert Plus | Center for Artificial Intelligence in Medicine & Imaging, accessed May 28, 2026, [https://aimi.stanford.edu/datasets/chexpert-plus](https://aimi.stanford.edu/datasets/chexpert-plus)  
54. Contradictory Results from Yolov8 vs Yolov5 · Issue \#8338 \- GitHub, accessed May 28, 2026, [https://github.com/ultralytics/ultralytics/issues/8338](https://github.com/ultralytics/ultralytics/issues/8338)  
55. VinDr-CXR: An open dataset of chest X-rays with radiologist's annotations · GitHub, accessed May 28, 2026, [https://github.com/vinbigdata-medical/vindr-cxr](https://github.com/vinbigdata-medical/vindr-cxr)  
56. ONNX Runtime 1.8: mobile, web, and accelerated training | Microsoft Open Source Blog, accessed May 28, 2026, [https://opensource.microsoft.com/blog/2021/06/07/onnx-runtime-1-8-mobile-web-and-accelerated-training/](https://opensource.microsoft.com/blog/2021/06/07/onnx-runtime-1-8-mobile-web-and-accelerated-training/)  
57. \[Performance\] Inference time much longer when using JavaScript than when using Python · Issue \#14220 · microsoft/onnxruntime \- GitHub, accessed May 28, 2026, [https://github.com/microsoft/onnxruntime/issues/14220](https://github.com/microsoft/onnxruntime/issues/14220)  
58. onnxruntime-web is 11-17x times slower than native inference · Issue \#11181 \- GitHub, accessed May 28, 2026, [https://github.com/microsoft/onnxruntime/issues/11181](https://github.com/microsoft/onnxruntime/issues/11181)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAACoUlEQVR4Xu2Wv+vOURTHjxiI/IjIjyIsykYxMCj1ZWCRUpTBwF9ATI/VKINMDDIwWER80xOLMnynb4RBwiaTSX6c13M+9/mce9z7PBmU4b7qXc9zzv157jn3fkQajcbfsFi13mlh7h79XxtsnnXS9+X3NPxcK4MPVqvOqO6rrqgWdDrgG5VYJjboJ9Uv1QvVCudPG/ms+qbaLNYnQd8Z1U+x/jVYzGWxNoxDPxadYM67Ypvwwfwq1meNs03krdgmWNCh4IOh6kI0dhxWPRabkBMusUf1SKzN8+CDi1IOxEDMTiCmskhskUSFTkQh8krKqcPCH6jOivUl0iU4jf1ibY4GH2C/FY3KLtWHaKzBsR3sfjNgKTL3xDYc2aR6LXYq9GPiyHax9GSzX1Q7cvcI+nJiEdY1F401mCAtciA26Imx1xa7z/33XBLbJG0+qk7m7lH0r4sFa151NXePSQEkG2hfS9EqbICFJHaKDUZ0lnQ2olIrtpRWq1QvxTbmeSh2IgTiu5TTCt5Iv5mkZ1mLKTABkfJQ7Ax0TfoaqOFrhxwfSn+rUeDpN8FiTH/jlTgl/aWABpl3AkTTnwikoidVtqre5e4MXzucBkHh9Fgw12kCe6n2anAN/1DNqpYGXxEimgrdwyaY+Kbqdu4aE2uHgueNoOCfSP6QMhaFHuG0Y10lOOHaJfMHRGpjNIqlFZPzrnBqJQiAv5LZAH2OSV4LLAT70NkS71VHolH62q3NnUExx+JMMNAd6VMlQuoMg42CZ8F8BXg4NeylQq8V9Q2x1JoInwDHxV5jHpvTnS1C0ZNW/lWl3TbVU7FFMM6GzsfFgO2c+0+0iSw3Fo8unyVpvNSeU/dpuLyznXe2/5ot0m9qt9jrz4fi3tSg0Wg0Go1/xW8gmIzasJq/4wAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADEAAAAXCAYAAACiaac3AAACdElEQVR4Xu2Wu2tVQRCHR1QQjC8MBKKFxkoULIKKkICIiBaKSAiCf4AWVhba2IgEBDtLEVLZ2YogKRQbH42djYJaaCEiCBYafMzH7CRz5u69lxsjSDgf/LjZ2cfZncduRFpa/muGsqGwKht6sDkbEutksPUGYovqhep3Rd0OlxlRvZHO+ZfCmFup759wTmxxfpeKb3R/7iicUn3IxuXkjtgG9uWOAfCIDueOwoxqLhuXk6/y92HulyrvVEejYb3qmGptaa9W7VIdFisiZ49qqvT3ot8GnK2q06odyQ7M/5aNAQ4x5g2q/LrYxpj4QHWk2I+rfqluqB77hDJuNrQjFDf9pEMNHHVVdVe1sdhIu1eq7aW9W2wN0rIGjiWdFtim2ls6mPgl9I2LeYPc2xTsjHsU2hE2RD+FWeOyWH9cb02xXSntM6Xd7WIgAo1UOiF2/XEYJl4IfQwkEgeDDRh3P9mcfjfTT9X3bJTmmjgA5+HEGuxrIZUieAGPUx8Oi7J4ZKfYwRqeKPg7gfg7MyG23vlk9xS8J5ZKn8XSrfagkTFVBxJOFmjkmfJWOg9xVix/eZQypBI3U7dc5sGaFztMBI97OpEZtYM6RICi7oBFWTyHKOe+e8mj8FCaL3G/94FDPFFtCDZuqOdilwue9zo8GcZE3qsmsxHwAB+PG/JCj9HxfOcBInoXQx/4A1VLJTgkFl3qz8mFzu9TWSzyCE5kfC3N5JlYwUX82otpwwe4gj+qXgY7m6ipxk2xPjz6QzUt9Xfnk9g4aoNvvRa7+rsyKot3tMNpCXWGD3IwfxiXAhE/IL3/W2V9Nn1bdU3qB21paVmp/AEaBpAxBc5g1AAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEYAAAAXCAYAAAC2/DnWAAADa0lEQVR4Xu2Xy6tPURTHlzwi70ceRd0MlIgBBkQmDAxMRAYkmZgoA0UpRf4BKZI8koGSgZIR6ZQBZYAi8ijKowgRCnmsz11ndfdv3X22+yNG51PfwVlrP85ee629zxFpaWn5j+xQfYhGZbhqXDQmDFZNisYM0zJi7G4Yqzquuq86pFrS6S6yUXVYdV61J/iKvFD9jEblmJg9amTtX6H6EXwXa58zKPHl9E4sUCXOis2zW7VWdVOs76K0UYZ5qmtibe+ojqoq1bakTSPLpO8lm/DFN/FEtSEaA2vExojthtZ2NidyRMw3ITqkL+AsODJddaNWT6erFzKoyCixCH6T8sLxEZwmWNT8aAwcVL1RzY4OyW+MB+xysKeQbbEfPBCzU345CFyRu6r1qqdiA7ELEQbBdy46aoaILbrETNVLybcbL/0DTxZ/UR2Q/Ds5lVjfKfUzbffXtlJWkBCNMMgF1QjVY7HBch04R/Dtio4aDt9YHpFVYmNQTpGVYj7OEaeqbXMTW45KrJ2fUQtUn1TXpTlbILfOXggGQfHdqKRzAoebg8OUwPmuRLaK7XoJyoHxR9fPzMOi39eibBwykLa5Eol8FmvnN+Oz+pkM/SPYOcrIOSX5ASkjJqOMeOEItqYSS6GMfLGpNktnUIANwJf7fIj4OP5u/uy3Ztfcls4a9MCQiil+HZfKKA1wEzEDyNh9qteqhYkdeAfa/m7cXGbF566YI527lmp10g4oI+xNpzhlxJVYgnpmjKvB7tctB3+Kn2lsVgk2i3Ycts5AA3MrGkjbk9K/LAgIA7LQFD+Um75SKaPcTZNCeTJGbOe3UcwMz5hSic5QPRT7hpmc2AcamDPRwGnN53/ET3O+dFMqaZ6IU5/dKl2n0PT9wibkAuCZxDdKE99rxbkrsb4Tg93hnS9J6Md/zT3J3y4emJi+e8Umitcbh9tpKV+J4B+QlJHfSI6Xgs+5WPpuF84efHHhPK9TfVVtCj7g6idgO6V/X+Cd+S3ohVTzFIupNkzsxyr6lyZtpta2j2LX7luxiTlAm/BAx3FZvENQsdHuhNhOpiwX8z8XW8wV1SvVlrRRBgLySKwv7VkfgSQpcsH6K2aJBYOyiAf030AAuZ22q8YEH1B+zEtgKD2yfiDQjr7046+6R/5BUFpaWlpauuQX4Nz2m/v6QkQAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADcAAAAXCAYAAACvd9dwAAACu0lEQVR4Xu2Wz6tNURTHv0IphOi9/MrPicgbKFJIkhgwkpQ/gIERAyX1ekkZ6nmlpOhNnoEykEjKZUQMKGGiLikDSSlK8mN9rb3OWWfdc+65mbx7e/dT3+45e+29715rr7X3Afr0mbLMEF0SvYuGwHzR4qBZhR5dyHbRD9G3aHCcE/1poy+iM1nvLsIvso7vKO+3AergFWgmdAXLRQ/QuXPs8zs2QlOUaf1WNBhsk8Im0fv0y5Ssc24BtM/taBB2Q51+LJoXbG2ZLdojmpnep4vWiHaiWNDrRQeTvRNuiS6IhkRfUe8c+7HP6WgQxqC2Y9HQjmmis9AFc/Ad0a7UvhcarfOihzYg9bvq3ssYQL4QSymOm5P1aIX19EG0LLRvhI69HtprWQotVu4QJ2DRGpZO91FMBfZruPcyTiF3hL8N6DimXhlsfyr6BA3c5aQmdNwhdJ4xGfugf04n47Zbnm9xbaSqLgymLwvf8M5xF8uw1H2G3DHqqGhl3u3/YKS5Q6w/gw7EOlkFdZiOV/ELOq5MzIYyuFu0r4uGAO9Lm8vfmytEL6AZyA3bbAbeGzegF6mniVbnDoteo/o4ZvqejI3Q4HGuqqAwJWmfGw2BV6I3ohEUs4D1Sh+Mu/awTfRTtDq3/YN/1nDvjOpn5Au8h+IBsRbFdPTsh853IhoStht1XIwNCWYTA2hkc1lU/ULtgPG7eSS1LYLu9nFnI9fgIhYw5/wCDJ7MtDFwddwUjUPvz2HXHufOnHsCrRMPCzymH1OOV8VH0XPXzhPWIk8xdY2FwWZiljCtYjtVtbvEnwm8D7em50rnlqD1bmE0ubAIj2M6bBf+ZEJnLBCVzvUK3OmX0A8Ewp07kJ6botH0TDpJ8a6CdW53LkvkUfol/MridydhVk2k556CC98BPbnjFwvf+e1bdZf26Qn+Akd+r9Y2OFwrAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAZCAYAAABEmrJwAAAD1ElEQVR4Xu2YT6jMURTHj1DkX3ryJ0oJJYoSUmwkkVgoRZYWSlYUJYuxsCAbEiUlCwtLSUnKxEZZKVKinlKKJIpC/pzPO/fMu3Pm/mbmRe9Z/D51mrnn3vnNOd8599+I1NTU1NSMFePUVqtdVjsZ+pzpYv0X1aaEPme82maxcUdC32jTTyzzxPrPq00MfQ557xfLe3fo68kqtVdqy1J7m9oztVmtESIf1e5lbd7jy5mRfGtTmx/sl9rR1ojRY7vaA7W5YnEcVLutNikb81NMWOdFshxyIVdyg5hjV2arPVXbmNpT1Zpq79WWJt9kMZG2pjbwHh99ziG1C2LJOM/FnjWaLBf7zsWpTXW+VnuiNpB8c8REWpHaQPy/ZTh+crsj7XkDed8KviKDYg/M4eFMKeeYWGUTkOMBH0htlpQvYlWfc03s+XnFlDintiA6M4iHauwH4kCAHD7vovF6Vawi8+XNc2ApAfIm9jxvIO+oWREGeSAEkIvqIFBTrKqdmWqP1a6k9g6xZxFgzqnkjwFGGmKVVYK1sKG2MPir4Ps+pPd8Np9J4LOTvHIWqb1VO5zaXhh53kDePcWdIDboq9gmxjTYIDZdPBEPBMu/JPr9V47iVvlLIATLSC5io+DrBj863/dObBOiWPaKra++bvqsi+JGf1PK4lb526CTQXEga8/d5IsiOtFfJWKVv4pLYmJCSexeIJDnRPEAlctewLPxRRGd6G9Kpzbd/G24uD+CHyHwM+WjiE70V4lY5e8GorJUucgjwcVleuf4ssWUjyI60d+UsohV/g4YxCKe4+L6gs9rU8ri+vGGoEsiurh+zOuHvxHXCwaRclxcCob1nw26SlzOvEDeJRGbyd9rk+4qbjO1CeKh2jQfIHYG5iwcN7Q1rREGgeInoX5AWKbvEhnZJub4PlIlLrl4YVyX9s2OAmAjjBtanjeQN/6evJHOgQiEz49Z68WmGbups1LtswxXKpvFI7V9rRGG//r9UFpjGwVfL76JxZazS2w2+DFrj9iuzwbocIwk1vmpTd48K88beHYsyCIs9DF5BCIhP3eWLhE7xT7X6xIxKP1dIhD2rHSK6MewkSwRHPxjThwJfZMGZlK8RPgS5vFXXSIY09clArj+clS5KXYs+9TePQQHeH6t48kQbFPbCINq+C5W9ffVTkj1nT3nX14igCoklxtiub1s7x6CYqCPq/FpsR+wtDeQN8sMefNayrsrW8TWR/6YyG8tOfj586LbnxyIsE7szs45cywhF+Ilt6p4B8RiPSPlCxSQN88ib55VU1NTU1NTU1Pz//IHzeoB1tn6Mz4AAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAbCAYAAACTHcTmAAAA+UlEQVR4Xu2UPQrCQBCFR7BQtBFEEQtBbKysFe1sPIm1lSfwAp7D1k48hL0QQbSysxHx5w2T4DpJNj9gIfrB17xJXrLZJUR/vpI5fMS04t4TmyvJjUG04AFm9CAKLrzr0CULFzqMokpSujSyMhyQFBbgypjFok9SOjOyMcnbcWkOToxZJN7STrALa7ADLyQPSwUvfUv+nXZg/XVZMqYkJSMjK7q5SRuu4U3lgfDSubRpZCXyL51Le3Cv8kAcklLeDI88yY5r+HvvdBiE7XxqYpXy23HpUQ9CsJY2yL/bLB8rG9bStHy0NPGPJYwhyRnlz3SGm/fxn9/lCb/qPR0612y+AAAAAElFTkSuQmCC>